import { z } from 'zod';
import { handler, body, intParam, bad } from '@/lib/api';
import { requireSession, HttpError } from '@/lib/auth';
import { db, today } from '@/lib/db';

const TextNote = z.object({
  bookId: z.number().int().positive(),
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
  content: z.string().trim().max(4000),
  godSpoke: z.boolean().optional(),
  devotionId: z.number().int().positive().nullish(),
});

export async function GET(req: Request) {
  return handler(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const bookId = url.searchParams.get('book');

    if (bookId) {
      const chapter = intParam(req, 'chapter');
      return {
        notes: db()
          .prepare(
            `SELECT id, book_id, chapter, verse, kind, content, media_path, god_spoke, created_at
             FROM verse_notes WHERE user_id = ? AND book_id = ? AND chapter = ? ORDER BY verse, id`,
          )
          .all(session.uid, Number(bookId), chapter),
      };
    }

    // 全部笔记（我的页面用），带经卷名
    return {
      notes: db()
        .prepare(
          `SELECT n.id, n.book_id, b.name_cn AS book_name, n.chapter, n.verse, n.kind,
                  n.content, n.media_path, n.god_spoke, n.created_at
           FROM verse_notes n JOIN bible_books b ON b.id = n.book_id
           WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 300`,
        )
        .all(session.uid),
    };
  });
}

/** 文字笔记 / 标记"神对我说话" */
export async function POST(req: Request) {
  return handler(async () => {
    const session = await requireSession();

    // 笔记一律以文字入库：口述先走 /api/transcribe 转成文字，这里不收任何上传文件
    const data = await body(req, TextNote);
    if (!data.content && !data.godSpoke) bad('笔记内容不能为空');

    const info = db()
      .prepare(
        `INSERT INTO verse_notes
           (user_id, book_id, chapter, verse, kind, content, god_spoke, devotion_id)
         VALUES (?, ?, ?, ?, 'text', ?, ?, ?)`,
      )
      .run(
        session.uid,
        data.bookId,
        data.chapter,
        data.verse,
        data.content,
        data.godSpoke ? 1 : 0,
        data.devotionId ?? null,
      );

    markEngaged(session.uid, data.bookId, data.chapter);
    return { id: info.lastInsertRowid };
  });
}

export async function DELETE(req: Request) {
  return handler(async () => {
    const session = await requireSession();
    const id = intParam(req, 'id');
    const info = db()
      .prepare(`DELETE FROM verse_notes WHERE id = ? AND user_id = ?`)
      .run(id, session.uid);
    if (!info.changes) throw new HttpError(404, '笔记不存在');
    return { ok: true };
  });
}

/** 有笔记就说明有互动，计入"真正读过"的判定依据（R-D6） */
function markEngaged(userId: number, bookId: number, chapter: number) {
  db()
    .prepare(
      `INSERT INTO reading_logs (user_id, day, book_id, chapter, engaged) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(user_id, day, book_id, chapter) DO UPDATE SET engaged = 1`,
    )
    .run(userId, today(), bookId, chapter);
}
