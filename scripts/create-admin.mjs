/**
 * 创建（或重置）管理员账号 —— 系统里的第一个用户只能这样产生，
 * 因为界面上没有注册入口。
 *
 * 用法：
 *   node scripts/create-admin.mjs 13800000000 陈弟兄
 *   node scripts/create-admin.mjs 13800000000 陈弟兄 我的密码
 */
import { scryptSync, randomBytes } from 'node:crypto';
import { connect } from './db.mjs';

const [phone, name, givenPassword] = process.argv.slice(2);
if (!phone || !name) {
  console.error('用法: node scripts/create-admin.mjs <手机号> <姓名> [密码]');
  process.exit(1);
}

const conn = await connect();

function hash(plain) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(plain, salt, 64).toString('hex')}`;
}

function generate(length = 10) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(randomBytes(length), (b) => alphabet[b % alphabet.length]).join('');
}

const password = givenPassword || generate();
const [[existing]] = await conn.query('SELECT id FROM users WHERE phone = ?', [phone]);

if (existing) {
  await conn.query(
    `UPDATE users SET name=?, password_hash=?, role='admin', status='active', must_change_pw=0 WHERE id=?`,
    [name, hash(password), existing.id],
  );
  console.log(`已更新管理员（id=${existing.id}）`);
} else {
  const [info] = await conn.query(
    `INSERT INTO users (phone, name, password_hash, role, status, must_change_pw)
     VALUES (?, ?, ?, 'admin', 'active', 0)`,
    [phone, name, hash(password)],
  );
  await conn.query(
    `INSERT IGNORE INTO reading_settings (user_id, daily_chapters) VALUES (?, ?)`,
    [info.insertId, Number(process.env.DAILY_CHAPTERS || 4)],
  );
  console.log(`已创建管理员（id=${info.insertId}）`);
}

console.log('----------------------------');
console.log(`手机号: ${phone}`);
console.log(`密码:   ${password}`);
console.log('----------------------------');
if (!givenPassword) console.log('这是随机生成的密码，请立即记下并登录后修改。');
await conn.end();
