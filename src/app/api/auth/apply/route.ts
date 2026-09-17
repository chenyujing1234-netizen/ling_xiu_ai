import { z } from 'zod';
import { handler, body, bad } from '@/lib/api';
import { db } from '@/lib/db';

// R-A2：提交使用申请。不创建账号，只创建一条待审批记录。
const Schema = z.object({
  phone: z.string().trim().regex(/^1\d{10}$/, '请填写正确的 11 位手机号'),
  note: z.string().trim().max(300).optional(),
});

// 申请时不再收姓名，但 users.name 非空、且管理端与"我的"页面都要显示，
// 用手机号后 4 位兜一个；管理员本来也是按手机号认人
function displayName(phone: string) {
  return `用户${phone.slice(-4)}`;
}

export async function POST(req: Request) {
  return handler(async () => {
    const data = await body(req, Schema);
    const conn = db();

    const existingUser = conn.prepare(`SELECT id FROM users WHERE phone = ?`).get(data.phone);
    if (existingUser) bad('该手机号已经开通，请直接登录');

    const pending = conn
      .prepare(`SELECT id FROM access_requests WHERE phone = ? AND status = 'pending'`)
      .get(data.phone);
    if (pending) bad('你的申请已提交，请等待管理员审批');

    conn
      .prepare(
        `INSERT INTO access_requests (phone, name, church, note) VALUES (?, ?, ?, ?)`,
      )
      .run(data.phone, displayName(data.phone), null, data.note ?? null);

    return { ok: true };
  });
}
