#!/usr/bin/env node
/**
 * 按 src/lib/schema.mysql.sql 建表。可重复执行（全是 CREATE TABLE IF NOT EXISTS）。
 *
 *   node scripts/mysql-init.mjs          # 建表
 *   node scripts/mysql-init.mjs --show   # 只看现状，不动结构
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mysql from 'mysql2/promise';

for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(join(process.cwd(), file), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* 没有就算了 */
  }
}

const cfg = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

if (!cfg.host || !cfg.user || !cfg.database) {
  console.log('× 缺少连接配置，请在 .env.local 填 MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE');
  process.exit(1);
}

const conn = await mysql.createConnection({ ...cfg, multipleStatements: true });
console.log(`已连接 ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);

const show = async () => {
  const [tables] = await conn.query(
    `SELECT TABLE_NAME AS t FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
    [cfg.database],
  );
  if (!tables.length) {
    console.log('  （库里还没有表）');
    return;
  }
  // 逐张 COUNT：information_schema.TABLE_ROWS 在 InnoDB 上只是估算，
  // 常年显示 0，看着像数据丢了
  for (const { t } of tables) {
    const [[c]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
    console.log(`  ${String(t).padEnd(20)} ${String(c.n).padStart(6)} 行`);
  }
};

if (process.argv.includes('--show')) {
  await show();
  await conn.end();
  process.exit(0);
}

const sql = readFileSync(join(process.cwd(), 'src', 'lib', 'schema.mysql.sql'), 'utf8');
// 逐条执行而不是一次性丢给 multipleStatements：出错时能指出是哪张表
const stmts = sql
  .split(';')
  .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
  .filter(Boolean);

let done = 0;
for (const stmt of stmts) {
  const name = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] ?? stmt.slice(0, 40);
  try {
    await conn.query(stmt);
    done++;
  } catch (err) {
    console.log(`\n× 建 ${name} 失败：${err.message}`);
    await conn.end();
    process.exit(1);
  }
}

console.log(`\n√ ${done} 条语句执行完毕，现在的表：`);
await show();
await conn.end();
