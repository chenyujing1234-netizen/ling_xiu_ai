import { z } from 'zod';
import { handler, body, intParam } from '@/lib/api';
import { requireSession, requireAdmin, HttpError } from '@/lib/auth';
import { db } from '@/lib/db';

// R-F1/F2：讲道视频等外部资源。成员只读，管理员可增删。
const Schema = z.object({
  title: z.string().trim().min(1, '请填写标题').max(120),
  url: z.string().trim().url('请填写完整链接（含 https://）'),
  bookId: z.number().int().min(1).max(66),
  chapter: z.number().int().positive(),
  speaker: z.string().trim().max(60).optional(),
  source: z.string().trim().max(60).optional(),
  verseStart: z.number().int().nonnegative().optional(),
  verseEnd: z.number().int().nonnegative().optional(),
  startSec: z.number().int().nonnegative().nullish(),
  endSec: z.number().int().nonnegative().nullish(),
  note: z.string().trim().max(300).optional(),
});

export async function GET(req: Request) {
  return handler(async () => {
    await requireSession();
    const url = new URL(req.url);
    if (!url.searchParams.get('book')) {
      return {
        resources: db()
          .prepare(
            `SELECT r.*, b.name_cn AS book_name FROM sermon_resources r
             JOIN bible_books b ON b.id = r.book_id ORDER BY r.id DESC LIMIT 200`,
          )
          .all(),
      };
    }
    const bookId = intParam(req, 'book');
    const chapter = intParam(req, 'chapter');
    return {
      resources: db()
        .prepare(
          `SELECT * FROM sermon_resources WHERE book_id = ? AND chapter = ? ORDER BY id DESC`,
        )
        .all(bookId, chapter),
    };
  });
}

export async function POST(req: Request) {
  return handler(async () => {
    const session = await requireAdmin();
    const d = await body(req, Schema);
    const info = db()
      .prepare(
        `INSERT INTO sermon_resources
           (title, speaker, source, url, book_id, chapter, verse_start, verse_end, start_sec, end_sec, note, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        d.title,
        d.speaker ?? null,
        d.source ?? null,
        d.url,
        d.bookId,
        d.chapter,
        d.verseStart ?? 1,
        d.verseEnd ?? 0,
        d.startSec ?? null,
        d.endSec ?? null,
        d.note ?? null,
        session.uid,
      );
    return { id: info.lastInsertRowid };
  });
}

export async function DELETE(req: Request) {
  return handler(async () => {
    await requireAdmin();
    const id = intParam(req, 'id');
    const info = db().prepare(`DELETE FROM sermon_resources WHERE id = ?`).run(id);
    if (!info.changes) throw new HttpError(404, '资源不存在');
    return { ok: true };
  });
}
