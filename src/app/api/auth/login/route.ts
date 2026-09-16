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

const Schema = z.object({
  phone: z.string().trim().min(4, '请输入手机号'),
  password: z.string().min(1, '请输入密码'),
});

export async function POST(req: Request) {
  return handler(async () => {
    const { phone, password } = await body(req, Schema);

    // R-A7 限流
    if (tooManyAttempts(phone)) {
      throw new HttpError(429, '密码错误次数过多，请 15 分钟后再试');
    }

    const user = findUserByPhone(phone);
    // 统一错误文案，不暴露"手机号是否存在"
    const fail = () => {
      recordAttempt(phone, false);
      throw new HttpError(401, '手机号或密码不正确');
    };
    if (!user) fail();
    if (user!.status !== 'active') {
      recordAttempt(phone, false);
      throw new HttpError(403, '账号已停用，请联系管理员');
    }
    if (!verifyPassword(password, user!.password_hash)) fail();

    recordAttempt(phone, true);
    db()
      .prepare(`UPDATE users SET last_login_at = datetime('now','localtime') WHERE id = ?`)
      .run(user!.id);

    await setSessionCookie({
      uid: user!.id,
      name: user!.name,
      role: user!.role,
      mustChangePw: Boolean(user!.must_change_pw),
    });

    return { ok: true, mustChangePw: Boolean(user!.must_change_pw) };
  });
}
