import { handler, notFound } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import {
  getDevotion,
  inputsOf,
  canAdvance,
  STAGE_META,
  UNLOCK_SCORE,
  stageFeedbacksMap,
  stageFeedbackRagSourcesMap,
} from '@/lib/devotion';
import { resolveRange } from '@/lib/insights';
import { db } from '@/lib/db';
import { chapterNotesReviewStatus } from '@/lib/chapter-notes-review';
import { attachNoteReviewFlags } from '@/lib/note-review';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handler(async () => {
    const session = await requireSession();
    const id = Number((await ctx.params).id);
    const d = await getDevotion(id, session.uid);
    if (!d) notFound('灵修记录不存在');

    const conn = db();
    // 阶段未到 guided 之前不下发教练发言，避免前端提前拿到内容（R-D1）
    const showCoach = ['guided', 'life', 'prayer', 'done'].includes(d.stage);

    // 这几项互不依赖，一次并发发出去；数据库在外网，串起来问就是七倍的等待
    const [r, inputs, prompts, scores, coach, notes, gate, stageFeedbacks, stageFeedbackRagSources] =
      await Promise.all([
      resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end),
      inputsOf(d.id),
      conn
        .prepare(
          `SELECT id, layer, bridge, question FROM devotion_prompts WHERE devotion_id = ? ORDER BY id`,
        )
        .all(d.id),
      conn
        .prepare(
          `SELECT dimension, score, reason FROM devotion_scores WHERE devotion_id = ? ORDER BY id`,
        )
        .all(d.id),
      showCoach
        ? conn
            .prepare(
              `SELECT role, content, created_at, rag_sources FROM coach_messages WHERE devotion_id = ? ORDER BY id`,
            )
            .all(d.id)
        : Promise.resolve([]),
      conn
        .prepare(
          `SELECT id, verse, kind, content, media_path, god_spoke FROM verse_notes
           WHERE user_id = ? AND book_id = ? AND chapter = ? ORDER BY verse, id`,
        )
        .all(session.uid, d.book_id, d.chapter),
      canAdvance(d),
      stageFeedbacksMap(d.id),
      stageFeedbackRagSourcesMap(d.id),
    ]);

    const { parseRagSources } = await import('@/lib/rag-sources');
    const coachOut = (coach as { role: string; content: string; created_at: string; rag_sources?: string | null }[]).map(
      (m) => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
        ragSources: m.role === 'coach' ? parseRagSources(m.rag_sources) : [],
      }),
    );

    const chapterNotesReviewed = await chapterNotesReviewStatus(
      session.uid,
      d.book_id,
      d.chapter,
      notes as { id: number; verse: number; content: string; god_spoke: number }[],
    );
    const notesWithReview = await attachNoteReviewFlags(
      notes as { id: number; content: string }[],
    );

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
      inputs,
      prompts,
      scores,
      coach: coachOut,
      notes: notesWithReview,
      chapterNotesReviewed,
      gate,
      stageFeedbacks,
      stageFeedbackRagSources,
    };
  });
}
