import { z } from 'zod';
import { handler, body } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { setExplorePosition } from '@/lib/bible';

const Schema = z.object({
  bookId: z.number().int().min(1).max(66),
  chapter: z.number().int().min(1).max(150),
});

/** 记住「经文资料」里上次选中的经卷章 */
export async function POST(req: Request) {
  return handler(async () => {
    const session = await requireSession();
    const { bookId, chapter } = await body(req, Schema);
    await setExplorePosition(session.uid, bookId, chapter);
    return { ok: true, bookId, chapter };
  });
}
