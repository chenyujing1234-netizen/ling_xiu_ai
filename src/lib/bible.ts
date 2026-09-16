import { db } from './db';

export type Book = {
  id: number;
  name_cn: string;
  name_en: string;
  abbr_cn: string;
  chapters: number;
  testament: 'OT' | 'NT';
  genre: string;
};

export type Verse = {
  book_id: number;
  chapter: number;
  verse: number;
  cn: string;
  en: string;
};

export function allBooks(): Book[] {
  return db().prepare(`SELECT * FROM bible_books ORDER BY id`).all() as Book[];
}

export function getBook(id: number): Book | undefined {
  return db().prepare(`SELECT * FROM bible_books WHERE id = ?`).get(id) as Book | undefined;
}

export function getChapter(bookId: number, chapter: number): Verse[] {
  return db()
    .prepare(
      `SELECT book_id, chapter, verse, cn, en FROM bible_verses
       WHERE book_id = ? AND chapter = ? ORDER BY verse`,
    )
    .all(bookId, chapter) as Verse[];
}

export function getVerse(bookId: number, chapter: number, verse: number): Verse | undefined {
  return db()
    .prepare(
      `SELECT book_id, chapter, verse, cn, en FROM bible_verses
       WHERE book_id = ? AND chapter = ? AND verse = ?`,
    )
    .get(bookId, chapter, verse) as Verse | undefined;
}

export function getRange(bookId: number, chapter: number, from: number, to: number): Verse[] {
  return db()
    .prepare(
      `SELECT book_id, chapter, verse, cn, en FROM bible_verses
       WHERE book_id = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse`,
    )
    .all(bookId, chapter, from, to) as Verse[];
}

export function chapterVerseCount(bookId: number, chapter: number): number {
  const r = db()
    .prepare(`SELECT MAX(verse) m FROM bible_verses WHERE book_id = ? AND chapter = ?`)
    .get(bookId, chapter) as { m: number | null };
  return r.m ?? 0;
}

/**
 * 取某节的上下文窗口（R-B4：前 10 节、后 10 节）。
 * 跨章节边界时会自动延伸到上一章末尾 / 下一章开头，
 * 因为经文的上下文本来就不该被章节切断。
 */
export function contextWindow(bookId: number, chapter: number, verse: number, span = 10) {
  const book = getBook(bookId);
  if (!book) return { before: [], after: [] };

  const collect = (direction: -1 | 1): Verse[] => {
    const out: Verse[] = [];
    let c = chapter;
    let v = verse;
    while (out.length < span) {
      v += direction;
      if (v < 1) {
        if (c <= 1) break;
        c -= 1;
        v = chapterVerseCount(bookId, c);
        if (!v) break;
      } else if (v > chapterVerseCount(bookId, c)) {
        if (c >= book.chapters) break;
        c += 1;
        v = 1;
      }
      const row = getVerse(bookId, c, v);
      if (!row) break;
      out.push(row);
    }
    return direction === -1 ? out.reverse() : out;
  };

  return { before: collect(-1), after: collect(1) };
}

// ---------- 引用格式化 ----------

export function refLabel(bookId: number, chapter: number, from?: number, to?: number): string {
  const book = getBook(bookId);
  const name = book?.name_cn ?? `卷${bookId}`;
  if (!from) return `${name} ${chapter}章`;
  if (!to || to === from) return `${name} ${chapter}:${from}`;
  return `${name} ${chapter}:${from}-${to}`;
}

/** 缓存键：用于 passage_insights 去重 */
export function refKey(bookId: number, chapter: number, from: number, to: number): string {
  return `${bookId}-${chapter}-${from}-${to}`;
}

/** 拼成给 AI 的经文文本，带节号便于它引用 */
export function passageText(verses: Verse[], lang: 'cn' | 'en' | 'both' = 'cn'): string {
  return verses
    .map((v) => {
      if (lang === 'both') return `${v.verse}. ${v.cn}${v.en ? `\n   [EN] ${v.en}` : ''}`;
      return `${v.verse}. ${lang === 'cn' ? v.cn : v.en}`;
    })
    .join('\n');
}

// ---------- 每日读经计划 ----------

export type Settings = {
  user_id: number;
  daily_chapters: number;
  cursor_book: number;
  cursor_chapter: number;
  bilingual: number;
};

export function getSettings(userId: number): Settings {
  const conn = db();
  let row = conn.prepare(`SELECT * FROM reading_settings WHERE user_id = ?`).get(userId) as
    | Settings
    | undefined;
  if (!row) {
    const daily = Number(process.env.DAILY_CHAPTERS || 4);
    conn
      .prepare(`INSERT INTO reading_settings (user_id, daily_chapters) VALUES (?, ?)`)
      .run(userId, daily);
    row = conn.prepare(`SELECT * FROM reading_settings WHERE user_id = ?`).get(userId) as Settings;
  }
  return row;
}

/** 从游标开始，向后取 n 章作为今日读经范围（跨卷自动衔接） */
export function planFrom(bookId: number, chapter: number, count: number) {
  const books = allBooks();
  const plan: { bookId: number; chapter: number; name: string }[] = [];
  let bi = books.findIndex((b) => b.id === bookId);
  if (bi < 0) bi = 0;
  let c = chapter;
  while (plan.length < count && bi < books.length) {
    const book = books[bi];
    if (c > book.chapters) {
      bi += 1;
      c = 1;
      continue;
    }
    plan.push({ bookId: book.id, chapter: c, name: book.name_cn });
    c += 1;
  }
  return plan;
}

/** 推进游标到下一章 */
export function advanceCursor(userId: number, count: number) {
  const s = getSettings(userId);
  const plan = planFrom(s.cursor_book, s.cursor_chapter, count + 1);
  const next = plan[plan.length - 1] ?? { bookId: 1, chapter: 1 };
  db()
    .prepare(`UPDATE reading_settings SET cursor_book = ?, cursor_chapter = ? WHERE user_id = ?`)
    .run(next.bookId, next.chapter, userId);
}
