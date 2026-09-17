import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { readSceneImage } from '@/lib/media';

/**
 * 返回 AI 生成的经文意境配图。
 *
 * 与 /api/media 的区别：那里是个人的录音与手写，严格限本人；配图是按经文缓存的
 * 公共内容，登录用户都能看。但仍要登录 —— 未登录看不到任何界面（R-A1）。
 * 文件名带随机串、内容不会变，所以可以长缓存。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    const { data, mime } = await readSceneImage((await ctx.params).name);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Length': String(data.length),
      },
    });
  } catch {
    return NextResponse.json({ error: '配图不存在' }, { status: 404 });
  }
}
