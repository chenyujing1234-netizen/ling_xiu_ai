import { z } from 'zod';
import { handler, body, bad } from '@/lib/api';
import { requireAdmin, hashPassword, generatePassword } from '@/lib/auth';
import { db, transaction } from '@/lib/db';

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
      requests: await db()
        .prepare(
          `SELECT id, phone, name, church, note, status, created_at, reviewed_at, reject_reason
           FROM access_requests ORDER BY (status = 'pending') DESC, id DESC LIMIT 200`,
        )
        .all(),
    };
  });
}

/**
 * R-A3：审批。通过时用申请时用户自设的密码开通账号（must_change_pw=0）。
 * 仅对缺少 password_hash 的旧申请仍生成临时密码并在响应里返回一次明文。
 */
export async function POST(req: Request) {
  return handler(async () => {
    const admin = await requireAdmin();
    const payload = await body(req, Schema);
    const conn = db();

    const reqRow = await conn
      .prepare(`SELECT * FROM access_requests WHERE id = ?`)
      .get<{
        id: number;
        phone: string;
        name: string;
        church: string | null;
        status: string;
        password_hash: string | null;
      }>(payload.id);
    if (!reqRow) bad('申请不存在');
    if (reqRow!.status !== 'pending') bad('该申请已经处理过了');

    if (payload.action === 'reject') {
      await conn
        .prepare(
          `UPDATE access_requests
           SET status='rejected', reviewed_at=NOW(), reviewed_by=?, reject_reason=?
           WHERE id = ?`,
        )
        .run(admin.uid, payload.reason ?? null, payload.id);
      return { ok: true };
    }

    if (await conn.prepare(`SELECT 1 FROM users WHERE phone = ?`).get(reqRow!.phone)) {
      bad('该手机号已经开通过账号了');
    }

    const legacy = !reqRow!.password_hash?.trim();
    const password = legacy ? generatePassword(8) : null;
    const passwordHash = legacy ? hashPassword(password!) : reqRow!.password_hash!;
    const mustChange = legacy ? 1 : 0;
    await transaction(async (tx) => {
      const info = await tx
        .prepare(
          `INSERT INTO users (phone, name, password_hash, church, must_change_pw)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(reqRow!.phone, reqRow!.name, passwordHash, reqRow!.church, mustChange);
      await tx
        .prepare(`INSERT INTO reading_settings (user_id, daily_chapters) VALUES (?, ?)`)
        .run(info.lastInsertRowid, Number(process.env.DAILY_CHAPTERS || 4));
      await tx
        .prepare(
          `UPDATE access_requests
           SET status='approved', reviewed_at=NOW(), reviewed_by=? WHERE id = ?`,
        )
        .run(admin.uid, payload.id);
    });

    return {
      ok: true,
      phone: reqRow!.phone,
      name: reqRow!.name,
      ...(password ? { password } : {}),
    };
  });
}
