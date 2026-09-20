import { z } from 'zod';
import { handler, body } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { getSettings } from '@/lib/bible';
import { db } from '@/lib/db';
import { normalizeTheme, THEME_IDS } from '@/lib/themes';

const Schema = z.object({
  dailyChapters: z.number().int().min(1).max(20).optional(),
  cursorBook: z.number().int().min(1).max(66).optional(),
  cursorChapter: z.number().int().min(1).max(150).optional(),
  bilingual: z.boolean().optional(),
  theme: z.enum(THEME_IDS).optional(),
});

export async function GET() {
  return handler(async () => {
    const session = await requireSession();
    return { settings: await getSettings(session.uid) };
  });
}

export async function POST(req: Request) {
  return handler(async () => {
    const session = await requireSession();
    const d = await body(req, Schema);
    const current = await getSettings(session.uid);

    await db()
      .prepare(
        `UPDATE reading_settings
         SET daily_chapters = ?, cursor_book = ?, cursor_chapter = ?, bilingual = ?, theme = ?
         WHERE user_id = ?`,
      )
      .run(
        d.dailyChapters ?? current.daily_chapters,
        d.cursorBook ?? current.cursor_book,
        d.cursorChapter ?? current.cursor_chapter,
        d.bilingual === undefined ? current.bilingual : d.bilingual ? 1 : 0,
        d.theme ? normalizeTheme(d.theme) : normalizeTheme(current.theme),
        session.uid,
      );

    return { settings: await getSettings(session.uid) };
  });
}
