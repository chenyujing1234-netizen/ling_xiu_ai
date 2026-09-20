import { cookies } from 'next/headers';
import { db } from './db';
import { sanitizeLastPath } from './last-path';

export const RESUME_COOKIE = 'lx_resume';
const MAX_AGE = 30 * 24 * 3600;

export async function getResumePath(uid: number): Promise<string | null> {
  try {
    const row = await db()
      .prepare(`SELECT last_path FROM users WHERE id = ?`)
      .get<{ last_path: string | null }>(uid);
    return sanitizeLastPath(row?.last_path);
  } catch {
    return null;
  }
}

/** 与 DB 同步，供 middleware 在 Edge 读 cookie 做恢复跳转 */
export async function setResumeCookie(path: string | null) {
  const jar = await cookies();
  const safe = sanitizeLastPath(path);
  if (!safe || safe === '/') {
    jar.delete(RESUME_COOKIE);
    return;
  }
  jar.set(RESUME_COOKIE, safe, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    httpOnly: true,
  });
}
