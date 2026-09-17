import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getDevotion, streamGuidance, setStage } from '@/lib/devotion';
import { db } from '@/lib/db';

/**
 * 引导揭晓的流式接口（SSE）。主模型生成一段引导要 1-2 分钟，
 * 逐字推送让用户看得见进展，而不是对着转圈等两分钟。
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const id = Number((await ctx.params).id);
  const d = await getDevotion(id, session.uid);
  if (!d) return NextResponse.json({ error: '灵修记录不存在' }, { status: 404 });

  // R-D2：核心约束，没解锁就没有引导
  if (!d.unlocked) {
    return NextResponse.json(
      { error: '还没有解锁。请先写下你自己的观察、提问与作答，评估达标后才会开启引导。' },
      { status: 403 },
    );
  }

  // 已经生成过就直接回放，不重复消耗额度
  const existing = await db()
    .prepare(`SELECT content FROM coach_messages WHERE devotion_id = ? AND role='coach' ORDER BY id LIMIT 1`)
    .get<{ content: string }>(d.id);

  const encoder = new TextEncoder();
  const send = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (existing) {
          controller.enqueue(send({ type: 'delta', text: existing.content }));
          controller.enqueue(send({ type: 'done', cached: true }));
          return;
        }
        for await (const event of streamGuidance(d)) {
          // done 事件不重复回传全文，前端已经逐段拼好了
          controller.enqueue(send(event.type === 'done' ? { type: 'done' } : event));
        }
        if (d.stage === 'reflect') await setStage(d.id, 'guided');
      } catch (err) {
        controller.enqueue(send({ type: 'error', message: (err as Error).message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // 关掉 nginx 缓冲，否则流会被攒成一整块再发出
      'X-Accel-Buffering': 'no',
    },
  });
}
