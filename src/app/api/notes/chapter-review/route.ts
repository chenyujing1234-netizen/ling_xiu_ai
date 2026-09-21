import { handler, bad, intParam } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { reviewChapterNotes } from '@/lib/chapter-notes-review';

/** 本章所有文字笔记的陪读者总结点评 */
export async function POST(req: Request) {
  return handler(async () => {
    const session = await requireSession();
    const bookId = intParam(req, 'book');
    const chapter = intParam(req, 'chapter');
    if (bookId < 1 || bookId > 66) bad('经卷无效');
    if (chapter < 1) bad('章无效');

    const cacheOnly = new URL(req.url).searchParams.get('cacheOnly') === '1';
    return reviewChapterNotes(session.uid, bookId, chapter, { cacheOnly });
  });
}
