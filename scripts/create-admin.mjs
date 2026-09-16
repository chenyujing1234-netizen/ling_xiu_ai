/**
 * 创建（或重置）管理员账号 —— 系统里的第一个用户只能这样产生，
 * 因为界面上没有注册入口。
 *
 * 用法：
 *   node scripts/create-admin.mjs 13800000000 陈弟兄
 *   node scripts/create-admin.mjs 13800000000 陈弟兄 我的密码
 */
import Database from 'better-sqlite3';
import { scryptSync, randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [phone, name, givenPassword] = process.argv.slice(2);
if (!phone || !name) {
  console.error('用法: node scripts/create-admin.mjs <手机号> <姓名> [密码]');
  process.exit(1);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const conn = new Database(process.env.DB_PATH || join(ROOT, 'data', 'lingxiu.db'));

function hash(plain) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(plain, salt, 64).toString('hex')}`;
}

function generate(length = 10) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(randomBytes(length), (b) => alphabet[b % alphabet.length]).join('');
}

const password = givenPassword || generate();
const existing = conn.prepare('SELECT id FROM users WHERE phone = ?').get(phone);

if (existing) {
  conn
    .prepare(`UPDATE users SET name=?, password_hash=?, role='admin', status='active', must_change_pw=0 WHERE id=?`)
    .run(name, hash(password), existing.id);
  console.log(`已更新管理员（id=${existing.id}）`);
} else {
  const info = conn
    .prepare(
      `INSERT INTO users (phone, name, password_hash, role, status, must_change_pw)
       VALUES (?, ?, ?, 'admin', 'active', 0)`,
    )
    .run(phone, name, hash(password));
  conn
    .prepare(`INSERT OR IGNORE INTO reading_settings (user_id, daily_chapters) VALUES (?, ?)`)
    .run(info.lastInsertRowid, Number(process.env.DAILY_CHAPTERS || 4));
  console.log(`已创建管理员（id=${info.lastInsertRowid}）`);
}

console.log('----------------------------');
console.log(`手机号: ${phone}`);
console.log(`密码:   ${password}`);
console.log('----------------------------');
if (!givenPassword) console.log('这是随机生成的密码，请立即记下并登录后修改。');
conn.close();
