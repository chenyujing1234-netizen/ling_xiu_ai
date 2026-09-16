import { z } from 'zod';
import { handler, body, bad } from '@/lib/api';
import { requireAdmin, hashPassword, generatePassword } from '@/lib/auth';
import { db } from '@/lib/db';

const Schema = z.object({
  id: z.number().int().positive(),
  action: z.enum(['resetPassword', 'disable', 'enable', 'promote', 'demote']),
});

export async function GET() {
  return handler(async () => {
    await requireAdmin();
    return {
      users: db()
        .prepare(
          `SELECT u.id, u.phone, u.name, u.role, u.status, u.church, u.must_change_pw,
                  u.created_at, u.last_login_at,
                  (SELECT COUNT(*) FROM devotions d WHERE d.user_id = u.id AND d.stage='done') AS devotions,
                  (SELECT COUNT(*) FROM verse_notes n WHERE n.user_id = u.id) AS notes,
                  (SELECT MAX(day) FROM reading_logs r WHERE r.user_id = u.id AND r.engaged = 1) AS last_read
           FROM users u ORDER BY u.id`,
        )
        .all(),
    };
  });
}

export async function POST(req: Request) {
  return handler(async () => {
    const admin = await requireAdmin();
    const { id, action } = await body(req, Schema);
    const conn = db();

    const user = conn.prepare(`SELECT id, role, status FROM users WHERE id = ?`).get(id) as
      | { id: number; role: string; status: string }
      | undefined;
    if (!user) bad('用户不存在');
    // 不允许把自己搞停用或降权，避免把自己锁在门外
    if (user!.id === admin.uid && action !== 'resetPassword') {
      bad('不能对自己执行该操作');
    }

    switch (action) {
      case 'resetPassword': {
        const password = generatePassword(8);
        conn
          .prepare(`UPDATE users SET password_hash = ?, must_change_pw = 1 WHERE id = ?`)
          .run(hashPassword(password), id);
        return { ok: true, password };
      }
      case 'disable':
        conn.prepare(`UPDATE users SET status = 'disabled' WHERE id = ?`).run(id);
        return { ok: true };
      case 'enable':
        conn.prepare(`UPDATE users SET status = 'active' WHERE id = ?`).run(id);
        return { ok: true };
      case 'promote':
        conn.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(id);
        return { ok: true };
      case 'demote':
        conn.prepare(`UPDATE users SET role = 'member' WHERE id = ?`).run(id);
        return { ok: true };
    }
  });
}
