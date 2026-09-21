// MySQL 切换后的端到端自检：登录 → 读经 → 笔记 → 灵修七步的门禁 → 资料缓存
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const BASE = 'http://127.0.0.1:3210';
const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  dateStrings: true,
});

const [[lastPathCol]] = await conn.query(
  `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_path'`,
  [process.env.MYSQL_DATABASE],
);
if (!lastPathCol.c) {
  await conn.query(`ALTER TABLE users ADD COLUMN last_path VARCHAR(512) NULL`);
  console.log('  · 已添加 users.last_path 列');
}

const [[fbTable]] = await conn.query(
  `SELECT COUNT(*) AS c FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'devotion_stage_feedback'`,
  [process.env.MYSQL_DATABASE],
);
if (!fbTable.c) {
  await conn.query(`
    CREATE TABLE devotion_stage_feedback (
      devotion_id INT NOT NULL,
      stage VARCHAR(16) NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      feedback TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (devotion_id, stage),
      CONSTRAINT fk_stage_fb_dev FOREIGN KEY (devotion_id) REFERENCES devotions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('  · 已创建 devotion_stage_feedback 表');
}

const [[noteReviewTable]] = await conn.query(
  `SELECT COUNT(*) AS c FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'verse_note_reviews'`,
  [process.env.MYSQL_DATABASE],
);
if (!noteReviewTable.c) {
  await conn.query(`
    CREATE TABLE verse_note_reviews (
      note_id INT NOT NULL PRIMARY KEY,
      content_hash VARCHAR(64) NOT NULL,
      review TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_note_review FOREIGN KEY (note_id) REFERENCES verse_notes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('  · 已创建 verse_note_reviews 表');
}

const [[chapterReviewTable]] = await conn.query(
  `SELECT COUNT(*) AS c FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chapter_note_reviews'`,
  [process.env.MYSQL_DATABASE],
);
if (!chapterReviewTable.c) {
  await conn.query(`
    CREATE TABLE chapter_note_reviews (
      user_id INT NOT NULL,
      book_id INT NOT NULL,
      chapter INT NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      review TEXT NOT NULL,
      rag_sources TEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, book_id, chapter),
      CONSTRAINT fk_chapter_note_review_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('  · 已创建 chapter_note_reviews 表');
}

for (const [table, col] of [
  ['verse_note_reviews', 'rag_sources'],
  ['devotion_stage_feedback', 'rag_sources'],
  ['coach_messages', 'rag_sources'],
  ['passage_insights', 'rag_sources'],
]) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.MYSQL_DATABASE, table, col],
  );
  if (!row.c) {
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT NULL`);
    console.log(`  · 已添加 ${table}.${col} 列`);
  }
}

const [[reqPwCol]] = await conn.query(
  `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'access_requests' AND COLUMN_NAME = 'password_hash'`,
  [process.env.MYSQL_DATABASE],
);
if (!reqPwCol.c) {
  await conn.query(`ALTER TABLE access_requests ADD COLUMN password_hash VARCHAR(200) NULL`);
  console.log('  · 已添加 access_requests.password_hash 列');
}

for (const col of ['explore_book', 'explore_chapter', 'theme', 'font_scale']) {
  const def =
    col === 'theme'
      ? "VARCHAR(32) NOT NULL DEFAULT 'classic'"
      : col === 'font_scale'
        ? "VARCHAR(16) NOT NULL DEFAULT 'standard'"
        : 'INT NOT NULL DEFAULT 1';
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'reading_settings' AND COLUMN_NAME = ?`,
    [process.env.MYSQL_DATABASE, col],
  );
  if (!row.c) {
    await conn.query(`ALTER TABLE reading_settings ADD COLUMN ${col} ${def}`);
    console.log(`  · 已添加 reading_settings.${col} 列`);
  }
}

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log(`  √ ${label}${extra ? ` — ${extra}` : ''}`);
  } else {
    fail++;
    console.log(`  × ${label}${extra ? ` — ${extra}` : ''}`);
  }
};

let cookie = '';
const api = async (path, init = {}) => {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
    redirect: 'manual',
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 页面 HTML */
  }
  return { status: res.status, json, text, headers: res.headers };
};

const timed = async (label, fn) => {
  const t = Date.now();
  const out = await fn();
  console.log(`      ${label} 耗时 ${Date.now() - t}ms`);
  return out;
};

// ---------- 准备一个测试账号，直接写进 MySQL ----------
const PHONE = '13900000001';
const { scryptSync, randomBytes } = await import('node:crypto');
// 与 src/lib/auth.ts 的格式保持一致：scrypt$salt$hash
const salt = randomBytes(16).toString('hex');
const hash = scryptSync('Test123456', salt, 64).toString('hex');
await conn.query('DELETE FROM users WHERE phone = ?', [PHONE]);
const [ins] = await conn.query(
  `INSERT INTO users (phone, name, password_hash, must_change_pw, role) VALUES (?, ?, ?, 0, 'member')`,
  [PHONE, '自检账号', `scrypt$${salt}$${hash}`],
);
const uid = ins.insertId;
console.log(`测试账号 uid=${uid}\n`);

console.log('— 登录');
const login = await timed('登录', () =>
  api('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: PHONE, password: 'Test123456' }) }),
);
ok('密码正确可登录', login.status === 200 && login.json?.ok, `HTTP ${login.status}`);
const [[att]] = await conn.query('SELECT `ok` FROM login_attempts WHERE phone = ? ORDER BY id DESC LIMIT 1', [PHONE]);
ok('登录成功写入 login_attempts', att?.ok === 1);
const [[lastLogin]] = await conn.query('SELECT last_login_at FROM users WHERE id = ?', [uid]);
ok('last_login_at 已更新（NOW() 生效）', Boolean(lastLogin.last_login_at), String(lastLogin.last_login_at));
const savePath = await api('/api/me/last-path', {
  method: 'POST',
  body: JSON.stringify({ path: '/devotion?tab=explore&book=1&chapter=2' }),
});
ok('记录最后访问路径', savePath.json?.ok === true, savePath.status);
const relogin = await api('/api/auth/login', {
  method: 'POST',
  headers: { cookie: '' },
  body: JSON.stringify({ phone: PHONE, password: 'Test123456' }),
});
ok('登录返回上次路径', relogin.json?.lastPath === '/devotion?tab=explore&book=1&chapter=2', relogin.json?.lastPath);

const bad = await api('/api/auth/login', {
  method: 'POST',
  headers: { cookie: '' },
  body: JSON.stringify({ phone: PHONE, password: '错误密码' }),
});
ok('密码错误被拒', bad.status === 401, `HTTP ${bad.status}`);

console.log('\n— 读经：取整章（含笔记、资源、书目，并记录打开行为）');
const ch = await timed('创世记 1 章', () => api('/api/bible/chapter?book=1&chapter=1'));
ok('返回 31 节经文', ch.json?.verses?.length === 31, `实际 ${ch.json?.verses?.length}`);
ok('首节中文正确', ch.json?.verses?.[0]?.cn?.startsWith('起初'), ch.json?.verses?.[0]?.cn);
ok('英文对照有内容', Boolean(ch.json?.verses?.[0]?.en));
ok('返回 66 卷书目', ch.json?.books?.length === 66);
const [[log1]] = await conn.query(
  'SELECT engaged FROM reading_logs WHERE user_id = ? AND book_id = 1 AND chapter = 1',
  [uid],
);
ok('reading_logs 记下"打开过"且 engaged=0（INSERT IGNORE 生效）', log1?.engaged === 0);
// 再打开一次，验证不会撞唯一键
const ch2 = await api('/api/bible/chapter?book=1&chapter=1');
ok('重复打开同一章不报错', ch2.status === 200, `HTTP ${ch2.status}`);

console.log('\n— 上下文窗口（一次范围查询取前后 10 节，跨章衔接）');
const ctx = await timed('创世记 2:3 上下文', () => api('/api/bible/context?book=1&chapter=2&verse=3'));
ok('前 10 节取满', ctx.json?.before?.length === 10, `实际 ${ctx.json?.before?.length}`);
ok('后 10 节取满', ctx.json?.after?.length === 10, `实际 ${ctx.json?.after?.length}`);
ok('跨章回溯到第 1 章', ctx.json?.before?.some((v) => v.chapter === 1));
const short = await timed('诗篇 117:1（只有 2 节的短章）', () => api('/api/bible/context?book=19&chapter=117&verse=1'));
ok('短章也能凑满前 10 节（会向外扩章）', short.json?.before?.length === 10, `实际 ${short.json?.before?.length}`);
ok('短章引用标签正确', short.json?.ref === '诗篇 117:1', short.json?.ref);

console.log('\n— 笔记：写入、列出、标记、删除');
const note = await timed('写笔记', () =>
  api('/api/notes', {
    method: 'POST',
    body: JSON.stringify({ bookId: 1, chapter: 1, verse: 1, content: '神先说话，然后就有了。', godSpoke: true }),
  }),
);
ok('笔记写入成功并返回自增 id', note.status === 200 && Number(note.json?.id) > 0, `id=${note.json?.id}`);
const [[savedNote]] = await conn.query('SELECT content, god_spoke, created_at FROM verse_notes WHERE id = ?', [
  note.json?.id,
]);
ok('中文内容原样入库', savedNote?.content === '神先说话，然后就有了。', savedNote?.content);
ok('god_spoke 标记为 1', savedNote?.god_spoke === 1);
ok('created_at 是字符串（dateStrings 生效）', typeof savedNote?.created_at === 'string', String(savedNote?.created_at));
const [[log2]] = await conn.query(
  'SELECT engaged FROM reading_logs WHERE user_id = ? AND book_id = 1 AND chapter = 1',
  [uid],
);
ok('写笔记把当天该章升级为 engaged=1（ON DUPLICATE KEY 生效）', log2?.engaged === 1);

const noteList = await api('/api/notes');
ok('笔记列表带经卷名', noteList.json?.notes?.[0]?.book_name === '创世记', noteList.json?.notes?.[0]?.book_name);

console.log('\n— 灵修：创建会话与七步门禁');
const dev = await timed('创建灵修', () =>
  api('/api/devotion', { method: 'POST', body: JSON.stringify({ bookId: 1, chapter: 1 }) }),
);
const devId = dev.json?.id;
ok('灵修会话已创建', Number(devId) > 0 && dev.json?.stage === 'observe', `id=${devId} stage=${dev.json?.stage}`);

const again = await api('/api/devotion', { method: 'POST', body: JSON.stringify({ bookId: 1, chapter: 1 }) });
ok('同一段落重复开始会复用同一条（不重复建）', again.json?.id === devId);

const detail = await timed('灵修详情（7 项并发查询）', () => api(`/api/devotion/${devId}`));
ok('详情返回经文与门禁', detail.json?.passage?.verses?.length === 31 && detail.json?.gate);
// 整章灵修的范围会被解析成实际首末节，所以标签是 1:1-31 而不是"1章"
ok('引用标签正确', detail.json?.passage?.label === '创世记 1:1-31', detail.json?.passage?.label);
ok('观察不足时门禁拦住', detail.json?.gate?.ok === false, detail.json?.gate?.reason);

const shortInput = await api(`/api/devotion/${devId}/action`, {
  method: 'POST',
  body: JSON.stringify({ action: 'input', kind: 'observation', content: '很短' }),
});
ok('有一条观察即可放行', shortInput.json?.gate?.ok === true, shortInput.json?.gate?.reason ?? '通过');

const longText =
  '神在六日之内创造天地万物，每一日都以"神说"开始，以"神看着是好的"结束，第七日安息并定为圣日。';
const enough = await api(`/api/devotion/${devId}/action`, {
  method: 'POST',
  body: JSON.stringify({ action: 'input', kind: 'observation', content: longText }),
});
ok('多条观察仍放行', enough.json?.gate?.ok === true, enough.json?.gate?.reason ?? '通过');
ok('输入列表累计两条', enough.json?.inputs?.length === 2, `实际 ${enough.json?.inputs?.length}`);

// 未解锁时不能拿引导 —— 这是产品的核心约束，必须仍然由服务端拦住
const guide = await api(`/api/devotion/${devId}/action`, { method: 'POST', body: JSON.stringify({ action: 'guide' }) });
ok('未解锁拿不到引导（R-D2 仍然生效）', guide.status === 403, `HTTP ${guide.status}`);

// 阶段错配：观察阶段不能塞作答
const wrong = await api(`/api/devotion/${devId}/action`, {
  method: 'POST',
  body: JSON.stringify({ action: 'input', kind: 'answer', content: '想跳过前面直接作答' }),
});
ok('阶段不匹配的输入被拒', wrong.status === 409, `HTTP ${wrong.status}`);

// 推进到提问阶段
const adv = await api(`/api/devotion/${devId}/action`, { method: 'POST', body: JSON.stringify({ action: 'advance' }) });
ok('可推进到"自己提问"', adv.json?.stage === 'inquire', adv.json?.stage);
const back = await api(`/api/devotion/${devId}/action`, { method: 'POST', body: JSON.stringify({ action: 'retreat' }) });
ok('可回到上一步（观察）', back.json?.stage === 'observe', back.json?.stage);
const fwd = await api(`/api/devotion/${devId}/action`, { method: 'POST', body: JSON.stringify({ action: 'advance' }) });
ok('再次推进到提问', fwd.json?.stage === 'inquire', fwd.json?.stage);
const [[stageRow]] = await conn.query('SELECT stage, updated_at FROM devotions WHERE id = ?', [devId]);
ok('阶段已落库', stageRow?.stage === 'inquire');
ok('updated_at 被 touch（NOW() 生效）', Boolean(stageRow?.updated_at));

// 删除一条输入
const del = await api(`/api/devotion/${devId}/action`, {
  method: 'POST',
  body: JSON.stringify({ action: 'removeInput', inputId: enough.json.inputs[0].id }),
});
ok('删除输入成功', del.json?.ok === true && del.json?.inputs?.length === 1);

console.log('\n— 事务：出题（一次事务写多行）');
const prompts = await timed('出题（会调 AI，慢）', () =>
  api(`/api/devotion/${devId}/action`, { method: 'POST', body: JSON.stringify({ action: 'prompts' }) }),
);
ok('出题返回多道题', (prompts.json?.prompts?.length ?? 0) >= 3, `${prompts.json?.prompts?.length} 道`);
const [[pc]] = await conn.query('SELECT COUNT(*) n FROM devotion_prompts WHERE devotion_id = ?', [devId]);
ok('题目已在事务里落库', pc.n === prompts.json?.prompts?.length, `库里 ${pc.n} 条`);

console.log('\n— 资料缓存：已生成的内容能取回，且不触发 AI');
const cachedHit = await timed('约翰福音 3 章 elements（迁移过来的缓存）', () =>
  api('/api/insights?kind=elements&book=43&chapter=3&from=1&to=36&cacheOnly=1'),
);
ok('命中迁移过来的缓存', cachedHit.json?.data !== null, `people ${cachedHit.json?.data?.people?.length ?? 0} 位`);
ok('未解锁时要义被抽走（R-D1）', cachedHit.json?.data?.thesis === null && cachedHit.json?.unlocked === false);
const cachedMiss = await api('/api/insights?kind=graph&book=5&chapter=7&cacheOnly=1');
ok('没缓存就返回 null，不调 AI', cachedMiss.json?.data === null);

console.log('\n— 统计：首页与"我的"用到的汇总');
const [[stat]] = await conn.query(
  `SELECT (SELECT COUNT(*) FROM verse_notes WHERE user_id = ?) notes,
          (SELECT COUNT(*) FROM devotions WHERE user_id = ?) devs`,
  [uid, uid],
);
ok('笔记与灵修计数正确', stat.notes === 1 && stat.devs === 1, `笔记 ${stat.notes} 灵修 ${stat.devs}`);

const home = await timed('首页渲染', () => api('/'));
ok('首页正常渲染', home.status === 200 && home.text.includes('今日读经'), `HTTP ${home.status}`);
ok('首页显示笔记数', home.text.includes('读经笔记'));
const mePage = await timed('我的页面', () => api('/me'));
ok('"我的"页面正常', mePage.status === 200 && mePage.text.includes('自检账号'), `HTTP ${mePage.status}`);
// 读经页已移除，/read 接到灵修流程
const readPage = await timed('读经老地址', () => api('/read?book=1&chapter=1'));
ok('/read 老地址接到灵修流程',
  readPage.status === 307 && /\/devotion\/start\?book=1&chapter=1/.test(readPage.headers?.get('location') ?? ''),
  `HTTP ${readPage.status} → ${readPage.headers?.get('location') ?? '无 Location'}`);
const devPage = await timed('灵修页', () => api('/devotion'));
ok('灵修页正常，默认是我的灵修', devPage.status === 200 && devPage.text.includes('开始灵修'),
  `HTTP ${devPage.status}`);
ok('灵修页两个页签都在',
  ['我的灵修', '经文资料'].every((t) => devPage.text.includes(t)) && !devPage.text.includes('>读经<'));
ok('灵修详情带整章经文（流程里可长按写笔记）', detail.json?.passage?.verses?.length === 31,
  `${detail.json?.passage?.verses?.length ?? 0} 节`);
const notesPage = await api('/me/notes');
ok('笔记页显示刚写的笔记', notesPage.text.includes('神先说话'));

console.log('\n— 删除笔记');
const delNote = await api(`/api/notes?id=${note.json.id}`, { method: 'DELETE' });
ok('笔记删除成功', delNote.json?.ok === true);
const [[gone]] = await conn.query('SELECT COUNT(*) n FROM verse_notes WHERE id = ?', [note.json.id]);
ok('库里已删除', gone.n === 0);

console.log('\n— 未登录不得访问（邀请制的前提）');
cookie = '';
const anon = await api('/api/bible/chapter?book=1&chapter=1');
ok('未登录取经文被拒', anon.status === 401, `HTTP ${anon.status}`);
const anonPage = await fetch(`${BASE}/`, { redirect: 'manual' });
ok('未登录访问首页被重定向到登录', anonPage.status === 307 || anonPage.status === 302, `HTTP ${anonPage.status}`);

// ---------- 清理 ----------
await conn.query('DELETE FROM users WHERE id = ?', [uid]);
const [[left]] = await conn.query(
  'SELECT (SELECT COUNT(*) FROM devotions WHERE user_id = ?) d, (SELECT COUNT(*) FROM reading_logs WHERE user_id = ?) r',
  [uid, uid],
);
ok('删用户时级联清掉灵修与读经记录（外键 CASCADE 生效）', left.d === 0 && left.r === 0);

console.log(`\n${fail ? '×' : '√'} 通过 ${pass} 项，失败 ${fail} 项`);
await conn.end();
process.exit(fail ? 1 : 0);
