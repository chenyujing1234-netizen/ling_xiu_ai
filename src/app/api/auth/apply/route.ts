import { z } from 'zod';
import { after } from 'next/server';
import { handler, body, bad } from '@/lib/api';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { notifyAccessRequest } from '@/lib/mailer';

// R-A2：提交使用申请。不创建账号，只创建一条待审批记录。
const Schema = z.object({
  phone: z.string().trim().regex(/^1\d{10}$/, '请填写正确的 11 位手机号'),
  password: z.string().min(6, '登录密码至少 6 位').max(64),
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

    const existingUser = await conn.prepare(`SELECT id FROM users WHERE phone = ?`).get(data.phone);
    if (existingUser) bad('该手机号已经开通，请直接登录');

    const pending = await conn
      .prepare(`SELECT id FROM access_requests WHERE phone = ? AND status = 'pending'`)
      .get(data.phone);
    if (pending) bad('你的申请已提交，请等待管理员审批');

    await conn
      .prepare(
        `INSERT INTO access_requests (phone, name, password_hash, church, note) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(data.phone, displayName(data.phone), hashPassword(data.password), null, data.note ?? null);

    // 邀请制的工具，申请没人看见人就一直进不来，所以落库后立刻通知管理员。
    // 放进 after()：申请人不必等 SMTP 那几秒，发信失败也不该让他以为没提交成功
    const { total } = (await conn
      .prepare(`SELECT COUNT(*) AS total FROM access_requests WHERE status = 'pending'`)
      .get<{ total: number }>())!;
    after(() =>
      notifyAccessRequest({ phone: data.phone, note: data.note, pendingCount: Number(total) }),
    );

    return { ok: true };
  });
}
