#!/usr/bin/env node
/**
 * 把 SQLite 里的数据搬到 MySQL。可重复执行：每张表先清空再灌，
 * 所以搬完之后如果又在 SQLite 上产生了新数据，再跑一次即可。
 *
 *   node scripts/mysql-migrate.mjs           # 迁移
 *   node scripts/mysql-migrate.mjs --check   # 只对比两边行数
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
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

/**
 * 迁移顺序＝外键依赖顺序：被引用的表先灌。
 * 清空要反着来，否则外键会拦住 DELETE。
 */
const TABLES = [
  'users',
  'access_requests',
  'login_attempts',
  'bible_books',
  'bible_verses',
  'reading_settings',
  'reading_logs',
  'devotions',
  'verse_notes',
  'devotion_inputs',
  'devotion_prompts',
  'devotion_scores',
  'coach_messages',
  'passage_insights',
  'sermon_resources',
  'knowledge_docs',
];

/** SQLite 存的是 'YYYY-MM-DD HH:MM:SS' 字符串，MySQL 这几列是 DATETIME/DATE */
const EMPTY_TO_NULL = new Set([
  'last_login_at',
  'reviewed_at',
  'completed_at',
]);

const sqlitePath = process.env.DB_PATH || join(process.cwd(), 'data', 'lingxiu.db');
const sqlite = new Database(sqlitePath, { readonly: true });

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

console.log(`SQLite  ${sqlitePath}`);
console.log(`MySQL   ${process.env.MYSQL_USER}@${process.env.MYSQL_HOST}/${process.env.MYSQL_DATABASE}\n`);

const countMysql = async (t) => {
  const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
  return r.n;
};
const countSqlite = (t) => sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;

if (process.argv.includes('--check')) {
  let bad = 0;
  console.log('表名                 SQLite   MySQL');
  for (const t of TABLES) {
    const a = countSqlite(t);
    const b = await countMysql(t);
    if (a !== b) bad++;
    console.log(`${t.padEnd(20)} ${String(a).padStart(6)}  ${String(b).padStart(6)}  ${a === b ? '√' : '× 不一致'}`);
  }
  console.log(bad ? `\n× ${bad} 张表行数不一致` : '\n√ 两边行数完全一致');
  await conn.end();
  process.exit(bad ? 1 : 0);
}

// 清空：外键约束下要反序删，先删引用方
await conn.query('SET FOREIGN_KEY_CHECKS = 0');
for (const t of [...TABLES].reverse()) await conn.query(`DELETE FROM \`${t}\``);
await conn.query('SET FOREIGN_KEY_CHECKS = 1');
console.log('已清空目标表\n');

const BATCH = 500; // 31101 节经文一次灌完会超 max_allowed_packet，分批稳妥

for (const table of TABLES) {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  if (!rows.length) {
    console.log(`${table.padEnd(20)} 空表，跳过`);
    continue;
  }

  const cols = Object.keys(rows[0]);
  const quoted = cols.map((c) => `\`${c}\``).join(', ');
  const started = Date.now();

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = chunk.map((row) =>
      cols.map((c) => {
        const v = row[c];
        // 日期列里的空串在严格模式下会被拒，SQLite 那边偶尔留空
        if (EMPTY_TO_NULL.has(c) && (v === '' || v === undefined)) return null;
        return v === undefined ? null : v;
      }),
    );
    const placeholders = chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
    try {
      await conn.query(
        `INSERT INTO \`${table}\` (${quoted}) VALUES ${placeholders}`,
        values.flat(),
      );
    } catch (err) {
      console.log(`\n× ${table} 第 ${i + 1}..${i + chunk.length} 行失败：${err.message}`);
      console.log(`  首行样本：${JSON.stringify(chunk[0]).slice(0, 300)}`);
      await conn.end();
      process.exit(1);
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const got = await countMysql(table);
  console.log(
    `${table.padEnd(20)} ${String(rows.length).padStart(6)} 行 → ${String(got).padStart(6)} 行  ${secs}s ${
      rows.length === got ? '√' : '× 数目不对'
    }`,
  );
}

// 自增列的下一个值要顶到现有最大 id 之后，否则新插入会撞主键
for (const t of TABLES) {
  const [[r]] = await conn.query(
    `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND EXTRA LIKE '%auto_increment%'`,
    [process.env.MYSQL_DATABASE, t],
  ).then(([rows]) => [rows]);
  if (!r) continue;
  const [[m]] = await conn.query(`SELECT COALESCE(MAX(\`${r.c}\`), 0) + 1 AS next FROM \`${t}\``);
  await conn.query(`ALTER TABLE \`${t}\` AUTO_INCREMENT = ${m.next}`);
}
console.log('\n已把各表自增起点顶到现有最大 id 之后');

await conn.end();
console.log('\n√ 迁移完成，用 --check 复核行数');
