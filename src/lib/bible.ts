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

// 66 卷书目是固定不变的，缓在进程里，省掉每次页面渲染都往数据库跑一趟
let booksCache: Book[] | null = null;

export async function allBooks(): Promise<Book[]> {
  if (booksCache) return booksCache;
  booksCache = await db().prepare(`SELECT * FROM bible_books ORDER BY id`).all<Book>();
  return booksCache;
}

export async function getBook(id: number): Promise<Book | undefined> {
  return (await allBooks()).find((b) => b.id === id);
}

export async function getChapter(bookId: number, chapter: number): Promise<Verse[]> {
  return await db()
    .prepare(
      `SELECT book_id, chapter, verse, cn, en FROM bible_verses
       WHERE book_id = ? AND chapter = ? ORDER BY verse`,
    )
    .all<Verse>(bookId, chapter);
}

export async function getVerse(
  bookId: number,
  chapter: number,
  verse: number,
): Promise<Verse | undefined> {
  return await db()
    .prepare(
      `SELECT book_id, chapter, verse, cn, en FROM bible_verses
       WHERE book_id = ? AND chapter = ? AND verse = ?`,
    )
    .get<Verse>(bookId, chapter, verse);
}

export async function getRange(
  bookId: number,
  chapter: number,
  from: number,
  to: number,
): Promise<Verse[]> {
  return await db()
    .prepare(
      `SELECT book_id, chapter, verse, cn, en FROM bible_verses
       WHERE book_id = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse`,
    )
    .all<Verse>(bookId, chapter, from, to);
}

export async function chapterVerseCount(bookId: number, chapter: number): Promise<number> {
  const r = await db()
    .prepare(`SELECT MAX(verse) m FROM bible_verses WHERE book_id = ? AND chapter = ?`)
    .get<{ m: number | null }>(bookId, chapter);
  return r?.m ?? 0;
}

/**
 * 取某节的上下文窗口（R-B4：前 10 节、后 10 节）。
 * 跨章节边界时会自动延伸到上一章末尾 / 下一章开头，
 * 因为经文的上下文本来就不该被章节切断。
 *
 * 相邻章一次整段捞回来再在内存里切，别逐节查：那样是四十多次往返，
 * 本地文件时无所谓，换成网络上的数据库就是半秒。
 */
export async function contextWindow(bookId: number, chapter: number, verse: number, span = 10) {
  const book = await getBook(bookId);
  if (!book) return { before: [], after: [] };

  const pull = async (reach: number) =>
    await db()
      .prepare(
        `SELECT book_id, chapter, verse, cn, en FROM bible_verses
         WHERE book_id = ? AND chapter BETWEEN ? AND ? ORDER BY chapter, verse`,
      )
      .all<Verse>(bookId, Math.max(1, chapter - reach), Math.min(book.chapters, chapter + reach));

  const cut = (rows: Verse[]) => {
    const i = rows.findIndex((r) => r.chapter === chapter && r.verse === verse);
    if (i < 0) return null;
    return {
      before: rows.slice(Math.max(0, i - span), i),
      after: rows.slice(i + 1, i + 1 + span),
      // 取满了，或者已经顶到整卷的头尾，就不必再往外扩
      enough: (i >= span || chapter - 1 <= 1) && (rows.length - i > span || chapter + 1 >= book.chapters),
    };
  };

  const near = cut(await pull(1));
  if (!near) return { before: [], after: [] };
  if (near.enough) return { before: near.before, after: near.after };

  // 碰上诗篇 117 那种两节的短章，前后一章凑不够 10 节，再往外扩一次
  const wide = cut(await pull(3));
  return wide ? { before: wide.before, after: wide.after } : { before: near.before, after: near.after };
}

// ---------- 引用格式化 ----------

export async function refLabel(
  bookId: number,
  chapter: number,
  from?: number,
  to?: number,
): Promise<string> {
  const book = await getBook(bookId);
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
  explore_book?: number;
  explore_chapter?: number;
  theme?: string;
  bilingual: number;
};

/** 经文资料页上次浏览的经卷章（独立于今日读经游标） */
export function explorePosition(s: Settings): { book: number; chapter: number } {
  return {
    book: s.explore_book ?? s.cursor_book,
    chapter: s.explore_chapter ?? s.cursor_chapter,
  };
}

export async function setExplorePosition(userId: number, bookId: number, chapter: number) {
  await db()
    .prepare(`UPDATE reading_settings SET explore_book = ?, explore_chapter = ? WHERE user_id = ?`)
    .run(bookId, chapter, userId);
}

export async function getSettings(userId: number): Promise<Settings> {
  const conn = db();
  const sel = conn.prepare(`SELECT * FROM reading_settings WHERE user_id = ?`);
  const row = await sel.get<Settings>(userId);
  if (row) return row;

  const daily = Number(process.env.DAILY_CHAPTERS || 4);
  // 同一个人两个标签页同时进来会撞主键，用 IGNORE 让后到的那次悄悄作废
  await conn
    .prepare(`INSERT IGNORE INTO reading_settings (user_id, daily_chapters) VALUES (?, ?)`)
    .run(userId, daily);
  return (await sel.get<Settings>(userId))!;
}

/** 从游标开始，向后取 n 章作为今日读经范围（跨卷自动衔接） */
export async function planFrom(bookId: number, chapter: number, count: number) {
  const books = await allBooks();
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
export async function advanceCursor(userId: number, count: number) {
  const s = await getSettings(userId);
  const plan = await planFrom(s.cursor_book, s.cursor_chapter, count + 1);
  const next = plan[plan.length - 1] ?? { bookId: 1, chapter: 1 };
  await db()
    .prepare(`UPDATE reading_settings SET cursor_book = ?, cursor_chapter = ? WHERE user_id = ?`)
    .run(next.bookId, next.chapter, userId);
}
