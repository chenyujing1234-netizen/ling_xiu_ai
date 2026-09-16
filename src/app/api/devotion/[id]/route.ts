import { handler, notFound } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { getDevotion, inputsOf, canAdvance, STAGE_META, UNLOCK_SCORE } from '@/lib/devotion';
import { resolveRange } from '@/lib/insights';
import { db } from '@/lib/db';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handler(async () => {
    const session = await requireSession();
    const id = Number((await ctx.params).id);
    const d = getDevotion(id, session.uid);
    if (!d) notFound('灵修记录不存在');

    const r = resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end);
    const conn = db();

    // 阶段未到 guided 之前不下发教练发言，避免前端提前拿到内容（R-D1）
    const coach =
      d.stage === 'guided' || d.stage === 'life' || d.stage === 'prayer' || d.stage === 'done'
        ? conn
            .prepare(`SELECT role, content, created_at FROM coach_messages WHERE devotion_id = ? ORDER BY id`)
            .all(d.id)
        : [];

    return {
      devotion: d,
      stageMeta: STAGE_META,
      unlockScore: UNLOCK_SCORE(),
      passage: {
        label: r.label,
        genre: r.genre,
        verses: r.verses,
        from: r.from,
        to: r.to,
      },
      inputs: inputsOf(d.id),
      prompts: conn
        .prepare(`SELECT id, layer, bridge, question FROM devotion_prompts WHERE devotion_id = ? ORDER BY id`)
        .all(d.id),
      scores: conn
        .prepare(`SELECT dimension, score, reason FROM devotion_scores WHERE devotion_id = ? ORDER BY id`)
        .all(d.id),
      coach,
      notes: conn
        .prepare(
          `SELECT id, verse, kind, content, media_path, god_spoke FROM verse_notes
           WHERE user_id = ? AND book_id = ? AND chapter = ? ORDER BY verse, id`,
        )
        .all(session.uid, d.book_id, d.chapter),
      gate: canAdvance(d),
    };
  });
}
