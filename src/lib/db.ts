import mysql from 'mysql2/promise';

/**
 * MySQL 连接池。
 *
 * 形状故意做得和原来的 better-sqlite3 一样（prepare().get()/all()/run()），
 * 只是全部返回 Promise，所以调用处的差别就只是前面多一个 await。
 *
 * 表结构见 schema.mysql.sql，建表用 scripts/mysql-init.mjs。
 */

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (pool) return pool;

  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;
  if (!host || !user || !database) {
    throw new Error('数据库未配置：请在 .env.local 填 MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE');
  }

  pool = mysql.createPool({
    host,
    user,
    database,
    port: Number(process.env.MYSQL_PORT || 3306),
    password: process.env.MYSQL_PASSWORD,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL || 10),
    charset: 'utf8mb4',
    // 让 DATETIME / DATE 读出来仍是 'YYYY-MM-DD HH:MM:SS' 字符串。
    // 代码里有 created_at.slice(0, 16) 这类写法，换成 Date 对象就全崩了。
    dateStrings: true,
    // 这台库在外网，握手比本地文件慢得多，池子里的连接尽量留着复用
    idleTimeout: 60_000,
    enableKeepAlive: true,
  });
  return pool;
}

type Row = Record<string, unknown>;
type Args = unknown[];
/** 占位符能接的东西：都是标量，转义交给驱动 */
type Param = string | number | boolean | Date | Buffer | null;

/** mysql2 遇到 undefined 会直接抛错，统一按 NULL 送过去 */
const clean = (args: Args): Param[] => args.map((a) => (a === undefined ? null : a)) as Param[];

/** 池子和单条连接的 execute 重载对不上，收成一个函数省去类型纠缠 */
type Exec = (sql: string, values: Param[]) => Promise<[unknown, unknown]>;

export type Stmt = {
  get<T = Row>(...args: Args): Promise<T | undefined>;
  all<T = Row>(...args: Args): Promise<T[]>;
  run(...args: Args): Promise<{ changes: number; lastInsertRowid: number }>;
};

function prepare(exec: Exec, sql: string): Stmt {
  return {
    async get<T>(...args: Args) {
      const [rows] = await exec(sql, clean(args));
      return (rows as T[])[0];
    },
    async all<T>(...args: Args) {
      const [rows] = await exec(sql, clean(args));
      return rows as T[];
    },
    async run(...args: Args) {
      const [res] = await exec(sql, clean(args));
      const r = res as mysql.ResultSetHeader;
      return { changes: r.affectedRows ?? 0, lastInsertRowid: r.insertId ?? 0 };
    },
  };
}

export function db() {
  const p = getPool();
  const exec: Exec = (sql, values) => p.execute(sql, values);
  return { prepare: (sql: string) => prepare(exec, sql) };
}

/**
 * 事务。回调里必须用传进来的 tx，不能用 db()——
 * 那样会另外借一条连接，事务就管不住它了。
 */
export async function transaction<T>(fn: (tx: { prepare: (sql: string) => Stmt }) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  const exec: Exec = (sql, values) => conn.execute(sql, values);
  try {
    await conn.beginTransaction();
    const out = await fn({ prepare: (sql: string) => prepare(exec, sql) });
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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
