import { db, today } from './db';

/**
 * 连续天数只统计"真正读过"的日子（R-D6）：
 * 那一天必须有 engaged=1 的记录（有笔记或完成过灵修），翻页不算。
 */
export function streakOf(userId: number): number {
  const days = db()
    .prepare(
      `SELECT DISTINCT day FROM reading_logs
       WHERE user_id = ? AND engaged = 1 ORDER BY day DESC LIMIT 400`,
    )
    .all(userId) as { day: string }[];
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

export function summaryOf(userId: number): Summary {
  const conn = db();
  const t = today();
  const one = <T>(sql: string, ...args: unknown[]) => conn.prepare(sql).get(...args) as T;

  const todayLogs = one<{ opened: number; engaged: number }>(
    `SELECT COUNT(*) opened, COALESCE(SUM(engaged),0) engaged FROM reading_logs WHERE user_id = ? AND day = ?`,
    userId,
    t,
  );
  const dev = one<{ n: number; avg: number | null }>(
    `SELECT COUNT(*) n, AVG(score) avg FROM devotions WHERE user_id = ? AND stage = 'done'`,
    userId,
  );
  const notes = one<{ n: number; spoke: number }>(
    `SELECT COUNT(*) n, COALESCE(SUM(god_spoke),0) spoke FROM verse_notes WHERE user_id = ?`,
    userId,
  );

  return {
    streak: streakOf(userId),
    todayEngaged: todayLogs.engaged,
    todayOpened: todayLogs.opened,
    totalDevotions: dev.n,
    totalNotes: notes.n,
    godSpokeCount: notes.spoke,
    avgScore: Math.round(dev.avg ?? 0),
  };
}

/** 今日这些章的完成状态。用泛型保留调用方传入的其它字段（如经卷名） */
export function chapterStatus<T extends { bookId: number; chapter: number }>(
  userId: number,
  plan: T[],
) {
  const conn = db();
  return plan.map((p) => {
    const log = conn
      .prepare(
        `SELECT engaged FROM reading_logs WHERE user_id = ? AND day = ? AND book_id = ? AND chapter = ?`,
      )
      .get(userId, today(), p.bookId, p.chapter) as { engaged: number } | undefined;
    const devotion = conn
      .prepare(
        `SELECT id, stage FROM devotions WHERE user_id = ? AND book_id = ? AND chapter = ?
         ORDER BY id DESC LIMIT 1`,
      )
      .get(userId, p.bookId, p.chapter) as { id: number; stage: string } | undefined;
    return {
      ...p,
      opened: Boolean(log),
      engaged: Boolean(log?.engaged),
      devotionId: devotion?.id ?? null,
      devotionStage: devotion?.stage ?? null,
    };
  });
}
