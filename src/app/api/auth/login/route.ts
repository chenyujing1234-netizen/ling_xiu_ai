import { z } from 'zod';
import { handler, body } from '@/lib/api';
import {
  findUserByPhone,
  verifyPassword,
  setSessionCookie,
  tooManyAttempts,
  recordAttempt,
  HttpError,
} from '@/lib/auth';
import { db } from '@/lib/db';
import { sanitizeLastPath } from '@/lib/last-path';
import { setResumeCookie } from '@/lib/resume';

const Schema = z.object({
  phone: z.string().trim().min(4, '请输入手机号'),
  password: z.string().min(1, '请输入密码'),
});

export async function POST(req: Request) {
  return handler(async () => {
    const { phone, password } = await body(req, Schema);

    // R-A7 限流
    if (await tooManyAttempts(phone)) {
      throw new HttpError(429, '密码错误次数过多，请 15 分钟后再试');
    }

    const user = await findUserByPhone(phone);
    // 统一错误文案，不暴露"手机号是否存在"
    const fail = async () => {
      await recordAttempt(phone, false);
      throw new HttpError(401, '手机号或密码不正确');
    };
    if (!user) {
      // 手机号密码都对、但申请还没审批：只有密码能对上才提示真实状态，
      // 避免被人拿登录页探测"某个手机号是否提交过申请"
      const pending = await db()
        .prepare(
          `SELECT password_hash FROM access_requests WHERE phone = ? AND status = 'pending' LIMIT 1`,
        )
        .get<{ password_hash: string }>(phone);
      if (pending && verifyPassword(password, pending.password_hash)) {
        await recordAttempt(phone, false);
        throw new HttpError(403, '该手机号尚未通过审批，请等待管理员审核后再登录');
      }
      await fail();
    }
    if (user!.status !== 'active') {
      await recordAttempt(phone, false);
      throw new HttpError(403, '账号已停用，请联系管理员');
    }
    if (!verifyPassword(password, user!.password_hash)) await fail();

    await recordAttempt(phone, true);
    const row = await db()
      .prepare(
        `SELECT u.last_path, COALESCE(rs.guide_seen, 0) AS guide_seen
         FROM users u
         LEFT JOIN reading_settings rs ON rs.user_id = u.id
         WHERE u.id = ?`,
      )
      .get<{ last_path: string | null; guide_seen: number }>(user!.id);
    await db().prepare(`UPDATE users SET last_login_at = NOW() WHERE id = ?`).run(user!.id);

    await setSessionCookie({
      uid: user!.id,
      name: user!.name,
      role: user!.role,
      mustChangePw: Boolean(user!.must_change_pw),
    });

    const firstGuide = !row?.guide_seen;
    const lastPath = firstGuide
      ? '/devotion/start?book=1&chapter=1'
      : sanitizeLastPath(row?.last_path) ?? null;
    await setResumeCookie(lastPath);

    return {
      ok: true,
      mustChangePw: Boolean(user!.must_change_pw),
      lastPath,
    };
  });
}
