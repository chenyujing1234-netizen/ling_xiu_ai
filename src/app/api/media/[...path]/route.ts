import { requireSession } from '@/lib/auth';
import { readMedia, ownerOf } from '@/lib/media';
import { NextResponse } from 'next/server';

/**
 * 鉴权后返回私密媒体（录音、手写图）。
 *
 * 严格限本人：灵修录音与祷告是极私密的东西，管理员也不例外。
 * 管理员的职责是审批账号与维护资源，不包括旁听别人的祷告。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const rel = (await ctx.params).path.join('/');
  if (ownerOf(rel) !== session.uid) {
    return NextResponse.json({ error: '无权访问' }, { status: 403 });
  }

  try {
    const { data, mime } = await readMedia(rel);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=86400',
        'Content-Length': String(data.length),
      },
    });
  } catch {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  }
}
