/** 运维脚本共用的 MySQL 连接：读 .env.local 里的连接配置 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(join(ROOT, file), 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch {
      /* 没有就算了 */
    }
  }
}

export async function connect() {
  loadEnv();
  const cfg = {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    dateStrings: true,
  };
  if (!cfg.host || !cfg.user || !cfg.database) {
    console.error(
      '× 数据库未配置：请在 .env.local 填 MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE',
    );
    process.exit(1);
  }
  try {
    return await mysql.createConnection(cfg);
  } catch (err) {
    console.error(`× 连不上 ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}：${err.message}`);
    process.exit(1);
  }
}
