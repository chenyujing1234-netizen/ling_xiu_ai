import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// R-A1：未登录看不到任何界面。这里在边缘层统一拦截，
// 不依赖前端隐藏，也不依赖每个页面自己判断。
// 注意：middleware 跑在 Edge Runtime，不能访问 SQLite，因此只校验签名；
// 用户是否被停用由 getSession() 在 Node 侧二次校验。

const PUBLIC_PATHS = ['/login', '/apply'];
const PUBLIC_APIS = ['/api/auth/login', '/api/auth/apply'];

const CHANGE_PW_PATH = '/me/password';

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

  // 已登录访问登录/申请页 → 回首页
  if (authed && isPublicPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  if (isPublicPage || isPublicApi) return NextResponse.next();

  if (!authed) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
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
    return NextResponse.redirect(new URL(`${CHANGE_PW_PATH}?first=1`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  // 排除静态资源与上传的音频/手写图
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/|manifest.webmanifest|icon.svg).*)'],
};
