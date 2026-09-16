/**
 * 下载圣经文本到 data/raw/。
 * 中文：CUNPS 新标点和合本（简体）  英文：KJV（公有领域）
 * 按卷落盘，支持断点续传 —— 中断后重跑只补缺失的卷。
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');
const API = 'https://bolls.life';
const TRANSLATIONS = ['CUNPS', 'KJV'];
const CONCURRENCY = 8;

async function getJson(url, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30000);
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw new Error(`${url} 失败: ${err.message}`);
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}

const exists = (p) => access(p).then(() => true).catch(() => false);

/** 以 CONCURRENCY 为上限并发执行任务 */
async function pool(items, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function fetchTranslation(trans) {
  const dir = join(RAW, trans);
  await mkdir(dir, { recursive: true });

  const books = await getJson(`${API}/get-books/${trans}/`);
  await writeFile(join(dir, 'books.json'), JSON.stringify(books, null, 2));
  console.log(`[${trans}] 书卷目录: ${books.length} 卷`);

  const pending = [];
  for (const b of books) {
    if (!(await exists(join(dir, `${b.bookid}.json`)))) pending.push(b);
  }
  if (!pending.length) {
    console.log(`[${trans}] 全部 ${books.length} 卷已存在，跳过`);
    return;
  }
  console.log(`[${trans}] 待下载 ${pending.length} 卷`);

  let done = 0;
  await pool(pending, async (book) => {
    const chapters = [];
    for (let c = 1; c <= book.chapters; c++) {
      const verses = await getJson(`${API}/get-text/${trans}/${book.bookid}/${c}/`);
      chapters.push({
        chapter: c,
        verses: verses.map((v) => ({ verse: v.verse, text: v.text })),
      });
    }
    await writeFile(
      join(dir, `${book.bookid}.json`),
      JSON.stringify({ bookid: book.bookid, name: book.name, chapters }),
    );
    done++;
    console.log(`[${trans}] ${done}/${pending.length} ${book.name} (${book.chapters} 章)`);
  });
}

/** 校验：统计每个译本的节数，缺卷则报错退出 */
async function verify() {
  for (const trans of TRANSLATIONS) {
    const dir = join(RAW, trans);
    const books = JSON.parse(await readFile(join(dir, 'books.json'), 'utf8'));
    let verses = 0;
    const missing = [];
    for (const b of books) {
      const p = join(dir, `${b.bookid}.json`);
      if (!(await exists(p))) {
        missing.push(b.name);
        continue;
      }
      const data = JSON.parse(await readFile(p, 'utf8'));
      for (const ch of data.chapters) verses += ch.verses.length;
    }
    console.log(`[${trans}] 共 ${books.length - missing.length}/${books.length} 卷，${verses} 节`);
    if (missing.length) {
      console.error(`[${trans}] 缺失卷: ${missing.join(', ')} —— 请重跑本脚本`);
      process.exitCode = 1;
    }
  }
}

for (const t of TRANSLATIONS) await fetchTranslation(t);
await verify();
console.log('下载完成 → data/raw/');
