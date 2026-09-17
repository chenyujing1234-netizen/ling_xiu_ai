/**
 * 把 data/raw/ 的经文导入 MySQL。
 * 中文 CUNPS（新标点和合本简体） → cn 列；英文 KJV → en 列。
 * 只导入正典 66 卷（原始数据源含次经，一并过滤）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { connect, ROOT } from './db.mjs';

const RAW = join(ROOT, 'data', 'raw');

// 缩写与文体分类：用于目录页分组与 AI 提示中的体裁判断
const META = [
  ['创', 'OT', '律法'], ['出', 'OT', '律法'], ['利', 'OT', '律法'], ['民', 'OT', '律法'], ['申', 'OT', '律法'],
  ['书', 'OT', '历史'], ['士', 'OT', '历史'], ['得', 'OT', '历史'], ['撒上', 'OT', '历史'], ['撒下', 'OT', '历史'],
  ['王上', 'OT', '历史'], ['王下', 'OT', '历史'], ['代上', 'OT', '历史'], ['代下', 'OT', '历史'], ['拉', 'OT', '历史'],
  ['尼', 'OT', '历史'], ['斯', 'OT', '历史'],
  ['伯', 'OT', '诗歌'], ['诗', 'OT', '诗歌'], ['箴', 'OT', '诗歌'], ['传', 'OT', '诗歌'], ['歌', 'OT', '诗歌'],
  ['赛', 'OT', '先知'], ['耶', 'OT', '先知'], ['哀', 'OT', '先知'], ['结', 'OT', '先知'], ['但', 'OT', '先知'],
  ['何', 'OT', '先知'], ['珥', 'OT', '先知'], ['摩', 'OT', '先知'], ['俄', 'OT', '先知'], ['拿', 'OT', '先知'],
  ['弥', 'OT', '先知'], ['鸿', 'OT', '先知'], ['哈', 'OT', '先知'], ['番', 'OT', '先知'], ['该', 'OT', '先知'],
  ['亚', 'OT', '先知'], ['玛', 'OT', '先知'],
  ['太', 'NT', '福音'], ['可', 'NT', '福音'], ['路', 'NT', '福音'], ['约', 'NT', '福音'], ['徒', 'NT', '历史'],
  ['罗', 'NT', '书信'], ['林前', 'NT', '书信'], ['林后', 'NT', '书信'], ['加', 'NT', '书信'], ['弗', 'NT', '书信'],
  ['腓', 'NT', '书信'], ['西', 'NT', '书信'], ['帖前', 'NT', '书信'], ['帖后', 'NT', '书信'], ['提前', 'NT', '书信'],
  ['提后', 'NT', '书信'], ['多', 'NT', '书信'], ['门', 'NT', '书信'], ['来', 'NT', '书信'], ['雅', 'NT', '书信'],
  ['彼前', 'NT', '书信'], ['彼后', 'NT', '书信'], ['约一', 'NT', '书信'], ['约二', 'NT', '书信'], ['约三', 'NT', '书信'],
  ['犹', 'NT', '书信'], ['启', 'NT', '预言'],
];

/** 清理经文：去译者补字标签、去脚注、去 Strong 编号，保留纯经文 */
function clean(text) {
  return text
    .replace(/<sup>.*?<\/sup>/g, '')      // 〔或作…〕脚注
    .replace(/<S>\d+<\/S>/g, '')          // KJV Strong's 编号
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')              // <i> 译者补字：保留文字去掉标签
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')      // 剥离标签后遗留的空格
    .trim();
}

function loadTranslation(name) {
  const dir = join(RAW, name);
  if (!existsSync(join(dir, 'books.json'))) {
    throw new Error(`缺少 ${dir}/books.json，请先运行: npm run bible:fetch`);
  }
  const books = JSON.parse(readFileSync(join(dir, 'books.json'), 'utf8'));
  const out = new Map();
  for (const b of books) {
    if (b.bookid < 1 || b.bookid > 66) continue; // 过滤次经
    const p = join(dir, `${b.bookid}.json`);
    if (!existsSync(p)) {
      console.warn(`  ! ${name} 缺少第 ${b.bookid} 卷 (${b.name})`);
      continue;
    }
    out.set(b.bookid, { name: b.name, chapters: JSON.parse(readFileSync(p, 'utf8')).chapters });
  }
  return out;
}

const cn = loadTranslation('CUNPS');
const en = loadTranslation('KJV');
console.log(`中文 ${cn.size} 卷 / 英文 ${en.size} 卷`);

const conn = await connect();

const BOOK_SQL = `
  INSERT INTO bible_books (id, name_cn, name_en, abbr_cn, chapters, testament, genre)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    name_cn=VALUES(name_cn), name_en=VALUES(name_en), abbr_cn=VALUES(abbr_cn),
    chapters=VALUES(chapters), testament=VALUES(testament), genre=VALUES(genre)`;
// 空串不要覆盖已有译文：两个译本分别导入时，后一次不该把前一次抹掉
const VERSE_SQL = `
  INSERT INTO bible_verses (book_id, chapter, verse, cn, en) VALUES ?
  ON DUPLICATE KEY UPDATE
    cn = IF(VALUES(cn) <> '', VALUES(cn), bible_verses.cn),
    en = IF(VALUES(en) <> '', VALUES(en), bible_verses.en)`;

let verseCount = 0;
let missingEn = 0;
const BATCH = 500; // 一次几万行会超 max_allowed_packet

for (let id = 1; id <= 66; id++) {
  const c = cn.get(id);
  const e = en.get(id);
  if (!c) {
    console.warn(`跳过第 ${id} 卷：无中文数据`);
    continue;
  }
  const [abbr, testament, genre] = META[id - 1];
  await conn.query(BOOK_SQL, [id, c.name, e?.name ?? c.name, abbr, c.chapters.length, testament, genre]);

  // 以中文为基准逐节对齐英文（同一节号）
  const enIndex = new Map();
  for (const ch of e?.chapters ?? []) {
    for (const v of ch.verses) enIndex.set(`${ch.chapter}:${v.verse}`, clean(v.text));
  }
  const rows = [];
  for (const ch of c.chapters) {
    for (const v of ch.verses) {
      const enText = enIndex.get(`${ch.chapter}:${v.verse}`) ?? '';
      if (!enText) missingEn++;
      rows.push([id, ch.chapter, v.verse, clean(v.text), enText]);
      verseCount++;
    }
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    await conn.query(VERSE_SQL, [rows.slice(i, i + BATCH)]);
  }
}

const [[stat]] = await conn.query(`SELECT COUNT(*) n, SUM(en <> '') withEn FROM bible_verses`);
console.log(`导入完成：${verseCount} 节写入，库内共 ${stat.n} 节，其中 ${stat.withEn} 节有英文对照`);
if (missingEn) console.log(`（${missingEn} 节无对应英文，通常是节号切分差异，属正常）`);
const [[sample]] = await conn.query(
  `SELECT cn, en FROM bible_verses WHERE book_id=43 AND chapter=3 AND verse=16`,
);
console.log(sample);
await conn.end();
