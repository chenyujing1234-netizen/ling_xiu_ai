import { z } from 'zod';
import { handler, body, bad } from '@/lib/api';
import { db, nowStamp } from '@/lib/db';
import { generateSmsCode, hashSmsCode, sendSmsCode } from '@/lib/sms';

// 申请页发送短信验证码：60 秒重发冷却、每天每号最多 10 条、验证码 10 分钟有效。
// 无需登录（申请发生在注册前），middleware 已放行 /api/auth/sms-code。

const RESEND_COOLDOWN_S = 60;
const DAILY_LIMIT = 10;
const VALID_MINUTES = 10;

const Schema = z.object({
  phone: z.string().trim().regex(/^1\d{10}$/, '请填写正确的 11 位手机号'),
});

/** 'YYYY-MM-DD HH:MM:SS' → Date（本地时区） */
function parseStamp(s: string): Date {
  return new Date(s.replace(' ', 'T'));
}

/** Date → 'YYYY-MM-DD HH:MM:SS'（本地时区），与连接层 dateStrings 的格式一致 */
function fmt(d: Date): string {
  return d.toLocaleString('sv-SE').replace('T', ' ').slice(0, 19);
}

export async function POST(req: Request) {
  return handler(async () => {
    const data = await body(req, Schema);
    const conn = db();

    // 清掉一天前的旧验证码，表不至于无限涨
    await conn
      .prepare(`DELETE FROM sms_codes WHERE created_at < ?`)
      .run(fmt(new Date(Date.now() - 24 * 3600_000)));

    // 60 秒重发冷却
    const last = await conn
      .prepare(`SELECT created_at FROM sms_codes WHERE phone = ? ORDER BY id DESC LIMIT 1`)
      .get<{ created_at: string }>(data.phone);
    if (last) {
      const elapsed = (Date.now() - parseStamp(last.created_at).getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_S) {
        bad(`验证码已发送，请 ${Math.ceil(RESEND_COOLDOWN_S - elapsed)} 秒后再试`);
      }
    }

    // 每天每号发送上限
    const { total } = (await conn
      .prepare(`SELECT COUNT(*) AS total FROM sms_codes WHERE phone = ? AND created_at >= ?`)
      .get<{ total: number }>(data.phone, fmt(new Date(Date.now() - 24 * 3600_000))))!;
    if (Number(total) >= DAILY_LIMIT) bad('该手机号今天发送次数过多，请明天再试');

    const code = generateSmsCode();
    const ok = await sendSmsCode(data.phone, code);
    if (!ok) bad('短信发送失败，请稍后重试');

    await conn
      .prepare(`INSERT INTO sms_codes (phone, code_hash, expires_at, attempts, consumed) VALUES (?, ?, ?, 0, 0)`)
      .run(data.phone, hashSmsCode(data.phone, code), fmt(new Date(Date.now() + VALID_MINUTES * 60_000)));

    return { ok: true, resendAfter: RESEND_COOLDOWN_S };
  });
}
