import { z } from 'zod';
import { handler, body } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { getOrCreateDevotion } from '@/lib/devotion';
import { db } from '@/lib/db';

const StartSchema = z.object({
  bookId: z.number().int().min(1).max(66),
  chapter: z.number().int().positive(),
  from: z.number().int().nonnegative().optional(),
  to: z.number().int().nonnegative().optional(),
});

/** 我的灵修列表 */
export async function GET() {
  return handler(async () => {
    const session = await requireSession();
    const list = db()
      .prepare(
        `SELECT d.id, d.day, d.book_id, b.name_cn AS book_name, d.chapter, d.verse_start, d.verse_end,
                d.stage, d.score, d.unlocked, d.completed_at, d.created_at,
                (SELECT COUNT(*) FROM devotion_inputs i WHERE i.devotion_id = d.id) AS input_count
         FROM devotions d JOIN bible_books b ON b.id = d.book_id
         WHERE d.user_id = ? ORDER BY d.id DESC LIMIT 100`,
      )
      .all(session.uid);
    return { list };
  });
}

/** 开始（或继续）一次灵修 */
export async function POST(req: Request) {
  return handler(async () => {
    const session = await requireSession();
    const { bookId, chapter, from, to } = await body(req, StartSchema);
    const d = getOrCreateDevotion(session.uid, bookId, chapter, from ?? 1, to ?? 0);
    return { id: d.id, stage: d.stage };
  });
}
