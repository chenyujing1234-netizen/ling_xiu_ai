import { z } from 'zod';
import { handler, body, notFound, bad } from '@/lib/api';
import { requireSession, HttpError } from '@/lib/auth';
import {
  getDevotion,
  addInput,
  updateInput,
  setStage,
  canAdvance,
  canAdvancePrep,
  canAdvancePrepContent,
  isPrepStage,
  isCombinedDevotionUi,
  nextStage,
  ensurePrompts,
  scoreDevotion,
  generateGuidance,
  coachReply,
  completeDevotion,
  inputsOf,
  stageFeedback,
  stageContentFingerprint,
  getCachedStageFeedback,
  saveStageFeedback,
  FEEDBACK_ON_ADVANCE,
  retreatStage,
  MIN_ANSWER_CHARS,
  type Stage,
  type FeedbackStage,
} from '@/lib/devotion';
import { clampNoteReviewLength } from '@/lib/note-review';
import { parseRagSources } from '@/lib/rag-sources';
import { db } from '@/lib/db';

const Schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('input'),
    kind: z.enum(['observation', 'question', 'answer', 'life_fact', 'prayer']),
    content: z.string().trim().min(1, '内容不能为空').max(5000),
    promptId: z.number().int().positive().nullish(),
    refVerse: z.number().int().positive().nullish(),
  }),
  z.object({
    action: z.literal('updateInput'),
    inputId: z.number().int().positive(),
    content: z.string().trim().min(1, '内容不能为空').max(5000),
  }),
  z.object({ action: z.literal('removeInput'), inputId: z.number().int().positive() }),
  z.object({ action: z.literal('prompts') }),
  z.object({ action: z.literal('score') }),
  z.object({ action: z.literal('guide') }),
  z.object({ action: z.literal('coach'), text: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal('advance') }),
  z.object({ action: z.literal('finishPrep') }),
  z.object({ action: z.literal('retreat') }),
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
          observation: ['observe', 'inquire', 'reflect'],
          question: ['inquire', 'observe', 'reflect'],
          answer: ['reflect', 'observe', 'inquire'],
          life_fact: ['life', 'guided'],
          prayer: ['prayer', 'life'],
        };
        if (d.stage !== 'done' && !allowed[payload.kind].includes(d.stage)) {
          throw new HttpError(409, `当前阶段不能提交「${payload.kind}」`);
        }
        const inputId = await addInput(d.id, payload.kind, payload.content, {
          promptId: payload.promptId ?? null,
          refVerse: payload.refVerse ?? null,
        });
        const fresh = (await getDevotion(d.id, session.uid))!;
        return { ok: true, inputId, gate: await canAdvance(fresh), inputs: await inputsOf(d.id) };
      }

      case 'updateInput': {
        const row = await db()
          .prepare(`SELECT kind FROM devotion_inputs WHERE id = ? AND devotion_id = ?`)
          .get<{ kind: string }>(payload.inputId, d.id);
        if (!row) notFound('记录不存在');
        const allowed: Record<string, Stage[]> = {
          observation: ['observe', 'inquire', 'reflect'],
          question: ['inquire', 'observe', 'reflect'],
          answer: ['reflect', 'observe', 'inquire'],
          life_fact: ['life', 'guided'],
          prayer: ['prayer', 'life'],
        };
        if (d.stage !== 'done' && !allowed[row.kind]?.includes(d.stage)) {
          throw new HttpError(409, `当前阶段不能修改这条内容`);
        }
        await updateInput(payload.inputId, d.id, payload.content);
        const fresh = (await getDevotion(d.id, session.uid))!;
        return {
          ok: true,
          inputId: payload.inputId,
          gate: await canAdvance(fresh),
          inputs: await inputsOf(d.id),
        };
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
        const fresh = (await getDevotion(d.id, session.uid))!;
        if (!isPrepStage(fresh.stage) && fresh.stage !== 'reflect') {
          throw new HttpError(409, '当前阶段不能评估');
        }
        const inputs = await inputsOf(d.id);
        const chars = inputs
          .filter((i) => i.kind === 'answer')
          .map((i) => i.content)
          .join('\n')
          .replace(/\s/g, '').length;
        if (!inputs.some((i) => i.kind === 'answer') || chars < MIN_ANSWER_CHARS) {
          bad('请先回答默想里的至少一题');
        }
        const result = await scoreDevotion(fresh);
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
        return await coachReply(fresh, payload.text);
      }

      case 'finishPrep': {
        const fresh = (await getDevotion(d.id, session.uid))!;
        if (!isCombinedDevotionUi(fresh.stage)) throw new HttpError(409, '当前不在默想阶段');
        const gate = await canAdvancePrepContent(fresh);
        if (!gate.ok) throw new HttpError(409, gate.reason ?? '还不能完成灵修');
        await completeDevotion(fresh);
        return { stage: 'done' as Stage };
      }

      case 'advance': {
        const fresh = (await getDevotion(d.id, session.uid))!;
        if (isCombinedDevotionUi(fresh.stage)) {
          throw new HttpError(409, '请在本页写完后点「完成这次灵修」');
        }
        const gate = await canAdvance(fresh);
        if (!gate.ok) throw new HttpError(409, gate.reason ?? '还不能进入下一步');
        const fromStage = fresh.stage;
        let feedback: string | null = null;
        let feedbackRagSources: { id: string; name: string }[] = [];
        let feedbackSkipped = false;

        if (FEEDBACK_ON_ADVANCE.includes(fromStage)) {
          const fbStage = fromStage as FeedbackStage;
          const hash = await stageContentFingerprint(fresh, fromStage);
          const cached = await getCachedStageFeedback(fresh.id, fbStage);
          if (cached && cached.content_hash === hash && cached.feedback.trim()) {
            feedback = clampNoteReviewLength(cached.feedback);
            feedbackSkipped = true;
            feedbackRagSources = parseRagSources(cached.rag_sources);
          } else {
            const devotionId = fresh.id;
            void (async () => {
              try {
                const fb = await stageFeedback(fresh, fbStage);
                if (fb.feedback?.trim()) {
                  await saveStageFeedback(
                    devotionId,
                    fbStage,
                    hash,
                    fb.feedback.trim(),
                    fb.ragSources,
                  );
                }
              } catch (err) {
                console.warn('[devotion:stageFeedback:bg]', (err as Error).message);
              }
            })();
          }
        }

        const next = nextStage(fresh.stage);
        if (next === 'done') {
          await completeDevotion(fresh);
        } else {
          await setStage(fresh.id, next);
        }
        return {
          stage: next,
          feedback,
          feedbackRagSources,
          feedbackFor: fromStage,
          feedbackSkipped,
        };
      }

      case 'retreat': {
        const fresh = (await getDevotion(d.id, session.uid))!;
        try {
          const prev = await retreatStage(fresh);
          const updated = (await getDevotion(d.id, session.uid))!;
          return { stage: prev, gate: await canAdvance(updated) };
        } catch {
          throw new HttpError(409, '已经是第一步，不能再往回走');
        }
      }

      case 'complete': {
        const fresh = (await getDevotion(d.id, session.uid))!;
        const gate = isCombinedDevotionUi(fresh.stage)
          ? await canAdvancePrepContent(fresh)
          : await canAdvance(fresh);
        if (!gate.ok) throw new HttpError(409, gate.reason ?? '还有内容没写完');
        await completeDevotion(fresh);
        return { stage: 'done' };
      }
    }
  });
}
