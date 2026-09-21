import { db } from './db';

export async function countPendingAccessRequests(): Promise<number> {
  const row = await db()
    .prepare(`SELECT COUNT(*) AS n FROM access_requests WHERE status = 'pending'`)
    .get<{ n: number }>();
  return Number(row?.n ?? 0);
}
