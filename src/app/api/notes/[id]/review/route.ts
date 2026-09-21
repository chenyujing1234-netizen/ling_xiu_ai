import { handler, bad } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { reviewVerseNote } from '@/lib/note-review';

type Ctx = { params: Promise<{ id: string }> };

/** 对一条笔记生成或读取缓存的陪读者点评（含笔记内疑问的解答） */
export async function POST(req: Request, ctx: Ctx) {
  return handler(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const noteId = Number(id);
    if (!Number.isInteger(noteId) || noteId < 1) bad('无效的笔记 id');
    const cacheOnly = new URL(req.url).searchParams.get('cacheOnly') === '1';
    return reviewVerseNote(noteId, session.uid, { cacheOnly });
  });
}
