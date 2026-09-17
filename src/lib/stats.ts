import { db, today } from './db';

/**
 * 连续天数只统计"真正读过"的日子（R-D6）：
 * 那一天必须有 engaged=1 的记录（有笔记或完成过灵修），翻页不算。
 */
export async function streakOf(userId: number): Promise<number> {
  const days = await db()
    .prepare(
      'SELECT DISTINCT `day` FROM reading_logs WHERE user_id = ? AND engaged = 1 ORDER BY `day` DESC LIMIT 400',
    )
    .all<{ day: string }>(userId);
  if (!days.length) return 0;

  const set = new Set(days.map((d) => d.day));
  const cursor = new Date();
  // 今天还没读不算断，从今天或昨天起算
  if (!set.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);

  let n = 0;
  while (set.has(fmt(cursor))) {
    n += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

function fmt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type Summary = {
  streak: number;
  todayEngaged: number;
  todayOpened: number;
  totalDevotions: number;
  totalNotes: number;
  godSpokeCount: number;
  avgScore: number;
};

export async function summaryOf(userId: number): Promise<Summary> {
  const conn = db();
  const t = today();
  const one = <T>(sql: string, ...args: unknown[]) => conn.prepare(sql).get<T>(...args);

  // 四项互不相干，一起发出去，别一条等一条
  const [todayLogs, dev, notes, streak] = await Promise.all([
    one<{ opened: number; engaged: number }>(
      'SELECT COUNT(*) opened, COALESCE(SUM(engaged),0) engaged FROM reading_logs WHERE user_id = ? AND `day` = ?',
      userId,
      t,
    ),
    one<{ n: number; avg: number | null }>(
      `SELECT COUNT(*) n, AVG(score) avg FROM devotions WHERE user_id = ? AND stage = 'done'`,
      userId,
    ),
    one<{ n: number; spoke: number }>(
      `SELECT COUNT(*) n, COALESCE(SUM(god_spoke),0) spoke FROM verse_notes WHERE user_id = ?`,
      userId,
    ),
    streakOf(userId),
  ]);

  return {
    streak,
    todayEngaged: Number(todayLogs?.engaged ?? 0),
    todayOpened: Number(todayLogs?.opened ?? 0),
    totalDevotions: Number(dev?.n ?? 0),
    totalNotes: Number(notes?.n ?? 0),
    godSpokeCount: Number(notes?.spoke ?? 0),
    avgScore: Math.round(dev?.avg ?? 0),
  };
}

/** 今日这些章的完成状态。用泛型保留调用方传入的其它字段（如经卷名） */
export async function chapterStatus<T extends { bookId: number; chapter: number }>(
  userId: number,
  plan: T[],
) {
  if (!plan.length) return [];
  const conn = db();

  // 按章逐个查是 2N 次往返，这里两条查询把要用的全捞回来，在内存里对
  const where = plan.map(() => '(book_id = ? AND chapter = ?)').join(' OR ');
  const pairs = plan.flatMap((p) => [p.bookId, p.chapter]);

  const [logs, devotions] = await Promise.all([
    conn
      .prepare(
        'SELECT book_id, chapter, engaged FROM reading_logs WHERE user_id = ? AND `day` = ?',
      )
      .all<{ book_id: number; chapter: number; engaged: number }>(userId, today()),
    conn
      .prepare(
        `SELECT id, stage, book_id, chapter FROM devotions
         WHERE user_id = ? AND (${where}) ORDER BY id DESC`,
      )
      .all<{ id: number; stage: string; book_id: number; chapter: number }>(userId, ...pairs),
  ]);

  const key = (b: number, c: number) => `${b}-${c}`;
  const logMap = new Map(logs.map((l) => [key(l.book_id, l.chapter), l]));
  // 按 id 倒序取回，同一章第一次遇到的就是最近那次
  const devMap = new Map<string, { id: number; stage: string }>();
  for (const d of devotions) {
    const k = key(d.book_id, d.chapter);
    if (!devMap.has(k)) devMap.set(k, { id: d.id, stage: d.stage });
  }

  return plan.map((p) => {
    const log = logMap.get(key(p.bookId, p.chapter));
    const devotion = devMap.get(key(p.bookId, p.chapter));
    return {
      ...p,
      opened: Boolean(log),
      engaged: Boolean(log?.engaged),
      devotionId: devotion?.id ?? null,
      devotionStage: devotion?.stage ?? null,
    };
  });
}
