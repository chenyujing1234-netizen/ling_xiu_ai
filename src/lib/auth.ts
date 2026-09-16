import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';

export const SESSION_COOKIE = 'lx_session';
const SESSION_DAYS = 30;

export type Session = {
  uid: number;
  name: string;
  role: 'member' | 'admin';
  mustChangePw: boolean;
};

export type UserRow = {
  id: number;
  phone: string;
  name: string;
  password_hash: string;
  role: 'member' | 'admin';
  status: string;
  must_change_pw: number;
  church: string | null;
};

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error('AUTH_SECRET 未配置或过短，请在 .env.local 设置一个长随机字符串');
  }
  return new TextEncoder().encode(s);
}

// ---------- 密码 ----------

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** 生成便于口头/微信转达的初始密码：避免易混淆字符（0/O、1/l/I） */
export function generatePassword(length = 8): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

// ---------- 会话 ----------

export async function createSessionToken(s: Session): Promise<string> {
  return await new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      uid: Number(payload.uid),
      name: String(payload.name),
      role: payload.role === 'admin' ? 'admin' : 'member',
      mustChangePw: Boolean(payload.mustChangePw),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(s: Session) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(s), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** 读取当前会话（页面与路由处理器通用） */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await readSessionToken(token);
  if (!s) return null;
  // 校验用户仍然存在且未被停用（避免停用后旧 token 继续可用）
  const row = db()
    .prepare(`SELECT status, role, must_change_pw FROM users WHERE id = ?`)
    .get(s.uid) as { status: string; role: string; must_change_pw: number } | undefined;
  if (!row || row.status !== 'active') return null;
  return {
    ...s,
    role: row.role === 'admin' ? 'admin' : 'member',
    mustChangePw: Boolean(row.must_change_pw),
  };
}

/** API 中使用：无会话直接抛出 401 响应 */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, '请先登录');
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== 'admin') throw new HttpError(403, '需要管理员权限');
  return s;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------- 登录限流 ----------

const MAX_FAILS = 5;
const WINDOW_MINUTES = 15;

export function tooManyAttempts(phone: string): boolean {
  const row = db()
    .prepare(
      `SELECT COUNT(*) n FROM login_attempts
       WHERE phone = ? AND ok = 0 AND at > datetime('now','localtime',?)`,
    )
    .get(phone, `-${WINDOW_MINUTES} minutes`) as { n: number };
  return row.n >= MAX_FAILS;
}

export function recordAttempt(phone: string, ok: boolean) {
  db().prepare(`INSERT INTO login_attempts (phone, ok) VALUES (?, ?)`).run(phone, ok ? 1 : 0);
}

export function findUserByPhone(phone: string): UserRow | undefined {
  return db().prepare(`SELECT * FROM users WHERE phone = ?`).get(phone) as UserRow | undefined;
}
