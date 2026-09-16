import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data', 'lingxiu.db');

let instance: Database.Database | null = null;

export function db(): Database.Database {
  if (instance) return instance;
  const conn = new Database(DB_PATH);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  conn.exec(readFileSync(join(process.cwd(), 'src', 'lib', 'schema.sql'), 'utf8'));
  instance = conn;
  return conn;
}

/** 今天的日期字符串（本地时区），用作 day 字段 */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowStamp(): string {
  return new Date().toLocaleString('sv-SE').replace('T', ' ').slice(0, 19);
}
