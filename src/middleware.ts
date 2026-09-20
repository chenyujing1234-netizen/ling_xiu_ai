import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { sanitizeLastPath } from '@/lib/last-path';

const RESUME_COOKIE = 'lx_resume';

// R-A1：未登录看不到任何界面。这里在边缘层统一拦截，
// 不依赖前端隐藏，也不依赖每个页面自己判断。
// 注意：middleware 跑在 Edge Runtime，不能访问 SQLite，因此只校验签名；
// 用户是否被停用由 getSession() 在 Node 侧二次校验。

const PUBLIC_PATHS = ['/login', '/apply'];
const PUBLIC_APIS = ['/api/auth/login', '/api/auth/apply'];

const CHANGE_PW_PATH = '/me/password';

/**
 * 按「用户实际访问的地址」发重定向。
 *
 * 不能直接用 new URL(path, req.url)：`next start` 下 req.url 的 origin 是应用自己的
 * 监听地址（localhost:3210），经 nginx 反代后会把用户甩到内网地址上。Next.js 只认
 * X-Forwarded-Proto、不认 X-Forwarded-Host，所以这里自己按请求头拼出外部 origin。
 * 也不能改发相对 Location——middleware 内部会对 Location 做 URL 解析，相对路径直接抛错。
 */
function redirectTo(req: NextRequest, path: string) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  // 没有 Host 头（理论上不该发生）时退回原行为，至少不 500
  const base = host ? `${proto}://${host}` : req.url;
  return NextResponse.redirect(new URL(path, base));
}

async function readToken(token: string | undefined): Promise<{ mustChangePw?: boolean } | null> {
  if (!token) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as { mustChangePw?: boolean };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('lx_session')?.value;
  const payload = await readToken(token);
  const authed = payload !== null;

  const isPublicPage = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isPublicApi = PUBLIC_APIS.includes(pathname);

  // 已登录访问登录/申请页 → 回首页（或恢复上次页面）
  if (authed && isPublicPage) {
    return redirectTo(req, resumeEntry(req) ?? '/');
  }
  if (isPublicPage || isPublicApi) return NextResponse.next();

  if (!authed) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return redirectTo(req, `/login${next}`);
  }

  // R-A4：首次登录必须改密。放行改密页本身与改密接口，否则会重定向成环。
  if (
    payload.mustChangePw &&
    pathname !== CHANGE_PW_PATH &&
    !pathname.startsWith('/api/auth/')
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '请先修改初始密码' }, { status: 403 });
    }
    return redirectTo(req, `${CHANGE_PW_PATH}?first=1`);
  }

  // 已登录再次打开（常见为微信入口固定到 /）：跳到上次停留页
  if (authed && pathname === '/') {
    if (req.nextUrl.searchParams.get('home') === '1') {
      return NextResponse.next();
    }
    const resume = resumeEntry(req);
    if (resume) return redirectTo(req, resume);
  }

  return NextResponse.next();
}

function resumeEntry(req: NextRequest): string | null {
  const resume = sanitizeLastPath(req.cookies.get(RESUME_COOKIE)?.value);
  if (!resume || resume === '/') return null;
  return resume;
}

export const config = {
  // 排除静态资源与上传的音频
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/|manifest.webmanifest|icon.svg).*)'],
};
