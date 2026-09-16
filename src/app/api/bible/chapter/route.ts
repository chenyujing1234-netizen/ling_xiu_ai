import { handler, intParam, notFound } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { getBook, getChapter, allBooks } from '@/lib/bible';
import { db, today } from '@/lib/db';

export async function GET(req: Request) {
  return handler(async () => {
    const session = await requireSession();
    const bookId = intParam(req, 'book');
    const chapter = intParam(req, 'chapter');

    const book = getBook(bookId);
    if (!book) notFound('没有这卷书');
    if (chapter < 1 || chapter > book.chapters) notFound(`${book.name_cn}只有 ${book.chapters} 章`);

    const verses = getChapter(bookId, chapter);

    // 该章已有的笔记，标在经文旁边
    const notes = db()
      .prepare(
        `SELECT id, verse, kind, content, media_path, god_spoke, created_at
         FROM verse_notes WHERE user_id = ? AND book_id = ? AND chapter = ?
         ORDER BY verse, id`,
      )
      .all(session.uid, bookId, chapter);

    // 覆盖本章的讲道资源（R-F2）
    const resources = db()
      .prepare(
        `SELECT id, title, speaker, source, url, verse_start, verse_end, start_sec, end_sec, note
         FROM sermon_resources WHERE book_id = ? AND chapter = ? ORDER BY id DESC`,
      )
      .all(bookId, chapter);

    // 记录阅读行为（只是"打开过"，engaged 仍为 0，见 R-D6）
    db()
      .prepare(
        `INSERT INTO reading_logs (user_id, day, book_id, chapter) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, day, book_id, chapter) DO NOTHING`,
      )
      .run(session.uid, today(), bookId, chapter);

    const books = allBooks().map((b) => ({ id: b.id, name: b.name_cn, chapters: b.chapters, testament: b.testament }));

    return { book, chapter, verses, notes, resources, books };
  });
}
