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
    if (!user) await fail();
    if (user!.status !== 'active') {
      await recordAttempt(phone, false);
      throw new HttpError(403, '账号已停用，请联系管理员');
    }
    if (!verifyPassword(password, user!.password_hash)) await fail();

    await recordAttempt(phone, true);
    const row = await db()
      .prepare(`SELECT last_path FROM users WHERE id = ?`)
      .get<{ last_path: string | null }>(user!.id);
    await db().prepare(`UPDATE users SET last_login_at = NOW() WHERE id = ?`).run(user!.id);

    await setSessionCookie({
      uid: user!.id,
      name: user!.name,
      role: user!.role,
      mustChangePw: Boolean(user!.must_change_pw),
    });

    const lastPath = sanitizeLastPath(row?.last_path) ?? null;
    await setResumeCookie(lastPath);

    return {
      ok: true,
      mustChangePw: Boolean(user!.must_change_pw),
      lastPath,
    };
  });
}
