import { z } from 'zod';
import { handler, body, notFound, bad } from '@/lib/api';
import { requireSession, HttpError } from '@/lib/auth';
import {
  getDevotion,
  addInput,
  setStage,
  canAdvance,
  nextStage,
  ensurePrompts,
  scoreDevotion,
  generateGuidance,
  coachReply,
  completeDevotion,
  inputsOf,
  type Stage,
} from '@/lib/devotion';
import { db } from '@/lib/db';

const Schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('input'),
    kind: z.enum(['observation', 'question', 'answer', 'life_fact', 'prayer']),
    content: z.string().trim().min(1, '内容不能为空').max(5000),
    promptId: z.number().int().positive().nullish(),
    refVerse: z.number().int().positive().nullish(),
  }),
  z.object({ action: z.literal('removeInput'), inputId: z.number().int().positive() }),
  z.object({ action: z.literal('prompts') }),
  z.object({ action: z.literal('score') }),
  z.object({ action: z.literal('guide') }),
  z.object({ action: z.literal('coach'), text: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal('advance') }),
  z.object({ action: z.literal('complete') }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handler(async () => {
    const session = await requireSession();
    const id = Number((await ctx.params).id);
    const d = await getDevotion(id, session.uid);
    if (!d) notFound('灵修记录不存在');

    const payload = await body(req, Schema);

    switch (payload.action) {
      case 'input': {
        // 阶段与输入类型必须匹配 —— 防止绕过前端直接往后面阶段塞内容
        const allowed: Record<string, Stage[]> = {
          observation: ['observe'],
          question: ['inquire', 'observe'],
          answer: ['reflect'],
          life_fact: ['life', 'guided'],
          prayer: ['prayer', 'life'],
        };
        if (d.stage !== 'done' && !allowed[payload.kind].includes(d.stage)) {
          throw new HttpError(409, `当前阶段不能提交「${payload.kind}」`);
        }
        await addInput(d.id, payload.kind, payload.content, {
          promptId: payload.promptId ?? null,
          refVerse: payload.refVerse ?? null,
        });
        const fresh = (await getDevotion(d.id, session.uid))!;
        return { ok: true, gate: await canAdvance(fresh), inputs: await inputsOf(d.id) };
      }

      case 'removeInput': {
        await db()
          .prepare(`DELETE FROM devotion_inputs WHERE id = ? AND devotion_id = ?`)
          .run(payload.inputId, d.id);
        return {
          ok: true,
          inputs: await inputsOf(d.id),
          gate: await canAdvance((await getDevotion(d.id, session.uid))!),
        };
      }

      case 'prompts':
        return { prompts: await ensurePrompts(d) };

      case 'score': {
        // 必须先有作答才能评分
        const gate = await canAdvance({ ...d, stage: 'reflect', score: 0, unlocked: 0 });
        if (!gate.ok && gate.reason?.includes('请先回答')) bad(gate.reason);
        const result = await scoreDevotion(d);
        return result;
      }

      case 'guide': {
        const fresh = (await getDevotion(d.id, session.uid))!;
        // R-D2：没达到分数线，不给引导。这是产品的核心约束，服务端硬拦。
        if (!fresh.unlocked) {
          throw new HttpError(
            403,
            '还没有解锁。请先写下你自己的观察、提问与作答，评估达标后才会开启引导。',
          );
        }
        const existing = await db()
          .prepare(`SELECT content FROM coach_messages WHERE devotion_id = ? AND role='coach' ORDER BY id LIMIT 1`)
          .get<{ content: string }>(d.id);
        if (existing) return { guidance: existing.content, cached: true };

        const guidance = await generateGuidance(fresh);
        if (fresh.stage === 'reflect') await setStage(d.id, 'guided');
        return { guidance, cached: false };
      }

      case 'coach': {
        const fresh = (await getDevotion(d.id, session.uid))!;
        if (!fresh.unlocked) throw new HttpError(403, '尚未解锁引导');
        return { reply: await coachReply(fresh, payload.text) };
      }

      case 'advance': {
        const fresh = (await getDevotion(d.id, session.uid))!;
        const gate = await canAdvance(fresh);
        if (!gate.ok) throw new HttpError(409, gate.reason ?? '还不能进入下一步');
        const next = nextStage(fresh.stage);
        if (next === 'done') {
          await completeDevotion(fresh);
        } else {
          await setStage(fresh.id, next);
        }
        return { stage: next };
      }

      case 'complete': {
        const fresh = (await getDevotion(d.id, session.uid))!;
        const gate = await canAdvance(fresh);
        if (!gate.ok) throw new HttpError(409, gate.reason ?? '还有步骤没有完成');
        await completeDevotion(fresh);
        return { stage: 'done' };
      }
    }
  });
}
