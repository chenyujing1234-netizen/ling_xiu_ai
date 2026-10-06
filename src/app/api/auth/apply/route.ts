import { z } from 'zod';
import { after } from 'next/server';
import { handler, body, bad } from '@/lib/api';
import { db, nowStamp } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { notifyAccessRequest } from '@/lib/mailer';
import { hashSmsCode } from '@/lib/sms';

// R-A2：提交使用申请。不创建账号，只创建一条待审批记录。
// 必须先通过短信验证码校验，确认手机号真实有效。
const Schema = z.object({
  phone: z.string().trim().regex(/^1\d{10}$/, '请填写正确的 11 位手机号'),
  password: z.string().min(6, '登录密码至少 6 位').max(64),
  smsCode: z.string().trim().regex(/^\d{6}$/, '请填写 6 位短信验证码'),
  note: z.string().trim().max(300).optional(),
});

const MAX_VERIFY_ATTEMPTS = 5;

/** 校验短信验证码：取该手机号最新一条未消费的验证码比对，错一次记一次，防爆破 */
async function verifySmsCode(phone: string, code: string) {
  const conn = db();
  const rec = await conn
    .prepare(
      `SELECT id, code_hash, attempts, expires_at FROM sms_codes
       WHERE phone = ? AND consumed = 0 ORDER BY id DESC LIMIT 1`,
    )
    .get<{ id: number; code_hash: string; attempts: number; expires_at: string }>(phone);

  if (!rec || rec.expires_at < nowStamp()) bad('验证码已失效，请重新获取');
  if (rec.attempts >= MAX_VERIFY_ATTEMPTS) bad('验证码错误次数过多，请重新获取');
  if (rec.code_hash !== hashSmsCode(phone, code)) {
    await conn.prepare(`UPDATE sms_codes SET attempts = attempts + 1 WHERE id = ?`).run(rec.id);
    bad('验证码不正确');
  }
  await conn.prepare(`UPDATE sms_codes SET consumed = 1 WHERE id = ?`).run(rec.id);
}

// 申请时不再收姓名，但 users.name 非空、且管理端与"我的"页面都要显示，
// 用手机号后 4 位兜一个；管理员本来也是按手机号认人
function displayName(phone: string) {
  return `用户${phone.slice(-4)}`;
}

export async function POST(req: Request) {
  return handler(async () => {
    const data = await body(req, Schema);
    await verifySmsCode(data.phone, data.smsCode);
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
