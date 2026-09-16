/** 创建数据库并执行 schema。可重复运行（全部 IF NOT EXISTS）。 */
import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(ROOT, 'data'), { recursive: true });

const dbPath = process.env.DB_PATH || join(ROOT, 'data', 'lingxiu.db');
const conn = new Database(dbPath);
conn.pragma('journal_mode = WAL');
conn.exec(readFileSync(join(ROOT, 'src', 'lib', 'schema.sql'), 'utf8'));

const tables = conn
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
  .all()
  .map((r) => r.name);

console.log(`数据库就绪: ${dbPath}`);
console.log(`共 ${tables.length} 张表: ${tables.join(', ')}`);
conn.close();
