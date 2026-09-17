import { z } from 'zod';
import { handler, body, bad } from '@/lib/api';
import { requireSession, hashPassword, verifyPassword, setSessionCookie } from '@/lib/auth';
import { db } from '@/lib/db';

// R-A4：首次登录强制改密，也用于日常改密
const Schema = z.object({
  current: z.string().min(1, '请输入当前密码'),
  next: z.string().min(6, '新密码至少 6 位').max(64),
});

export async function POST(req: Request) {
  return handler(async () => {
    const session = await requireSession();
    const { current, next } = await body(req, Schema);

    const row = (await db()
      .prepare(`SELECT password_hash, name, role FROM users WHERE id = ?`)
      .get<{ password_hash: string; name: string; role: string }>(session.uid))!;

    if (!verifyPassword(current, row.password_hash)) bad('当前密码不正确');
    if (verifyPassword(next, row.password_hash)) bad('新密码不能与当前密码相同');

    await db()
      .prepare(`UPDATE users SET password_hash = ?, must_change_pw = 0 WHERE id = ?`)
      .run(hashPassword(next), session.uid);

    // 刷新会话，清掉 mustChangePw 标记
    await setSessionCookie({
      uid: session.uid,
      name: row.name,
      role: row.role === 'admin' ? 'admin' : 'member',
      mustChangePw: false,
    });

    return { ok: true };
  });
}
