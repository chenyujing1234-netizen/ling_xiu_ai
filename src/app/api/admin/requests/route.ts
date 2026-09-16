import { z } from 'zod';
import { handler, body, bad } from '@/lib/api';
import { requireAdmin, hashPassword, generatePassword } from '@/lib/auth';
import { db } from '@/lib/db';

const Schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), id: z.number().int().positive() }),
  z.object({
    action: z.literal('reject'),
    id: z.number().int().positive(),
    reason: z.string().trim().max(200).optional(),
  }),
]);

export async function GET() {
  return handler(async () => {
    await requireAdmin();
    return {
      requests: db()
        .prepare(
          `SELECT id, phone, name, church, note, status, created_at, reviewed_at, reject_reason
           FROM access_requests ORDER BY (status = 'pending') DESC, id DESC LIMIT 200`,
        )
        .all(),
    };
  });
}

/**
 * R-A3：审批。通过时由系统生成初始密码并**只在这一次响应里返回明文**，
 * 由管理员通过微信/电话线下转达 —— 系统不发短信、不发邮件。
 */
export async function POST(req: Request) {
  return handler(async () => {
    const admin = await requireAdmin();
    const payload = await body(req, Schema);
    const conn = db();

    const reqRow = conn
      .prepare(`SELECT * FROM access_requests WHERE id = ?`)
      .get(payload.id) as
      | { id: number; phone: string; name: string; church: string | null; status: string }
      | undefined;
    if (!reqRow) bad('申请不存在');
    if (reqRow!.status !== 'pending') bad('该申请已经处理过了');

    if (payload.action === 'reject') {
      conn
        .prepare(
          `UPDATE access_requests
           SET status='rejected', reviewed_at=datetime('now','localtime'), reviewed_by=?, reject_reason=?
           WHERE id = ?`,
        )
        .run(admin.uid, payload.reason ?? null, payload.id);
      return { ok: true };
    }

    if (conn.prepare(`SELECT 1 FROM users WHERE phone = ?`).get(reqRow!.phone)) {
      bad('该手机号已经开通过账号了');
    }

    const password = generatePassword(8);
    conn.transaction(() => {
      const info = conn
        .prepare(
          `INSERT INTO users (phone, name, password_hash, church, must_change_pw)
           VALUES (?, ?, ?, ?, 1)`,
        )
        .run(reqRow!.phone, reqRow!.name, hashPassword(password), reqRow!.church);
      conn
        .prepare(`INSERT INTO reading_settings (user_id, daily_chapters) VALUES (?, ?)`)
        .run(info.lastInsertRowid, Number(process.env.DAILY_CHAPTERS || 4));
      conn
        .prepare(
          `UPDATE access_requests
           SET status='approved', reviewed_at=datetime('now','localtime'), reviewed_by=? WHERE id = ?`,
        )
        .run(admin.uid, payload.id);
    })();

    return { ok: true, phone: reqRow!.phone, name: reqRow!.name, password };
  });
}
