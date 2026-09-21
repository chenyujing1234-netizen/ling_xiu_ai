-- 灵修AI 数据库结构（SQLite）
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ========== 认证：邀请制，无自助注册 ==========
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phone         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',   -- member | admin
  status        TEXT NOT NULL DEFAULT 'active',   -- active | disabled
  must_change_pw INTEGER NOT NULL DEFAULT 1,      -- 首次登录强制改密
  church        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  last_login_at TEXT,
  last_path     TEXT   -- 上次退出时的站内路径
);

-- 使用申请：用户提交手机号+自设密码 → 管理员审批 → 直接登录
CREATE TABLE IF NOT EXISTS access_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  phone        TEXT NOT NULL,
  name         TEXT NOT NULL,
  password_hash TEXT,
  church       TEXT,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  reviewed_at  TEXT,
  reviewed_by  INTEGER REFERENCES users(id),
  reject_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_req_status ON access_requests(status, created_at DESC);

-- 登录限流
CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  phone      TEXT NOT NULL,
  ok         INTEGER NOT NULL,
  at         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_attempt ON login_attempts(phone, at DESC);

-- ========== 圣经文本 ==========
CREATE TABLE IF NOT EXISTS bible_books (
  id        INTEGER PRIMARY KEY,          -- 1..66
  name_cn   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  abbr_cn   TEXT NOT NULL,
  chapters  INTEGER NOT NULL,
  testament TEXT NOT NULL,                -- OT | NT
  genre     TEXT NOT NULL                 -- 律法/历史/诗歌/先知/福音/书信/预言
);

CREATE TABLE IF NOT EXISTS bible_verses (
  book_id  INTEGER NOT NULL REFERENCES bible_books(id),
  chapter  INTEGER NOT NULL,
  verse    INTEGER NOT NULL,
  cn       TEXT NOT NULL DEFAULT '',
  en       TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (book_id, chapter, verse)
);

-- ========== 读经 ==========
CREATE TABLE IF NOT EXISTS reading_settings (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_chapters INTEGER NOT NULL DEFAULT 4,
  cursor_book    INTEGER NOT NULL DEFAULT 1,
  cursor_chapter INTEGER NOT NULL DEFAULT 1,
  explore_book   INTEGER NOT NULL DEFAULT 1,
  explore_chapter INTEGER NOT NULL DEFAULT 1,
  theme          TEXT NOT NULL DEFAULT 'classic',
  font_scale     TEXT NOT NULL DEFAULT 'standard',
  bilingual      INTEGER NOT NULL DEFAULT 1
);

-- 每天一条：记录读了哪些章，以及是否达成"真正读过"的判定（R-D6）
CREATE TABLE IF NOT EXISTS reading_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,              -- YYYY-MM-DD
  book_id     INTEGER NOT NULL,
  chapter     INTEGER NOT NULL,
  opened_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  seconds     INTEGER NOT NULL DEFAULT 0, -- 停留时长
  engaged     INTEGER NOT NULL DEFAULT 0, -- 是否有互动（笔记/灵修）
  UNIQUE(user_id, day, book_id, chapter)
);
CREATE INDEX IF NOT EXISTS idx_log_user_day ON reading_logs(user_id, day DESC);

-- 逐节笔记：长按经文产生（文字 / 历史录音）
CREATE TABLE IF NOT EXISTS verse_notes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id      INTEGER NOT NULL,
  chapter      INTEGER NOT NULL,
  verse        INTEGER NOT NULL,
  kind         TEXT NOT NULL,             -- text | audio（audio 为历史数据，现在只写 text）
  content      TEXT NOT NULL DEFAULT '',  -- 文字内容 / 录音转写文字
  media_path   TEXT,                      -- 历史音频的相对路径
  duration_ms  INTEGER,
  god_spoke    INTEGER NOT NULL DEFAULT 0,-- "这节神对我说话"
  devotion_id  INTEGER REFERENCES devotions(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_note_user ON verse_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_verse ON verse_notes(user_id, book_id, chapter, verse);

-- 逐节笔记的陪读者点评（笔记文字未改则复用）
CREATE TABLE IF NOT EXISTS verse_note_reviews (
  note_id       INTEGER PRIMARY KEY REFERENCES verse_notes(id) ON DELETE CASCADE,
  content_hash  TEXT NOT NULL,
  review        TEXT NOT NULL,
  rag_sources   TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS chapter_note_reviews (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id       INTEGER NOT NULL,
  chapter       INTEGER NOT NULL,
  content_hash  TEXT NOT NULL,
  review        TEXT NOT NULL,
  rag_sources   TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (user_id, book_id, chapter)
);

-- ========== 灵修会话（七阶段，强制顺序） ==========
CREATE TABLE IF NOT EXISTS devotions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,
  book_id       INTEGER NOT NULL,
  chapter       INTEGER NOT NULL,
  verse_start   INTEGER NOT NULL DEFAULT 1,
  verse_end     INTEGER NOT NULL DEFAULT 0,   -- 0 = 到本章末
  stage         TEXT NOT NULL DEFAULT 'observe', -- observe|inquire|reflect|guided|life|prayer|done
  score         INTEGER NOT NULL DEFAULT 0,
  unlocked      INTEGER NOT NULL DEFAULT 0,   -- 是否已解锁引导揭晓
  completed_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_dev_user ON devotions(user_id, created_at DESC);

-- 用户在各阶段的输入。kind 区分：
-- observation 观察 | question 自己的提问 | answer 作答 | life_fact 生命实事 | prayer 祷告
CREATE TABLE IF NOT EXISTS devotion_inputs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  devotion_id INTEGER NOT NULL REFERENCES devotions(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  content     TEXT NOT NULL,
  ref_verse   INTEGER,                    -- 关联到某一节
  prompt_id   INTEGER,                    -- 若为 answer，对应哪道系统题
  media_path  TEXT,                       -- 录音祷告等
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_input_dev ON devotion_inputs(devotion_id, kind);

-- 系统生成的思辨题（R-D4 四个层次 / R-E 文化载体）
CREATE TABLE IF NOT EXISTS devotion_prompts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  devotion_id INTEGER NOT NULL REFERENCES devotions(id) ON DELETE CASCADE,
  layer       TEXT NOT NULL,              -- fact | flow | theology | application
  bridge      TEXT,                        -- 引用的文化载体：歌曲/电影/名著/热点
  question    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_prompt_dev ON devotion_prompts(devotion_id);

-- 评分明细（多维度）
CREATE TABLE IF NOT EXISTS devotion_scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  devotion_id INTEGER NOT NULL REFERENCES devotions(id) ON DELETE CASCADE,
  dimension   TEXT NOT NULL,              -- observation|inquiry|thesis|personal
  score       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_score_dev ON devotion_scores(devotion_id, created_at DESC);

-- 引导式对话（AI 教练）
CREATE TABLE IF NOT EXISTS coach_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  devotion_id INTEGER NOT NULL REFERENCES devotions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,              -- user | coach
  content     TEXT NOT NULL,
  rag_sources TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_coach_dev ON coach_messages(devotion_id, id);

-- 各阶段「下一步」陪读者短评（内容未改则复用，不重复调 LLM）
CREATE TABLE IF NOT EXISTS devotion_stage_feedback (
  devotion_id   INTEGER NOT NULL REFERENCES devotions(id) ON DELETE CASCADE,
  stage         TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  feedback      TEXT NOT NULL,
  rag_sources   TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (devotion_id, stage)
);

-- ========== 结构化洞察缓存（控制 AI 成本，R-C5） ==========
CREATE TABLE IF NOT EXISTS passage_insights (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_key     TEXT NOT NULL,               -- 如 "1-3-1-24"
  kind        TEXT NOT NULL,               -- elements|context|timeline|graph|mindmap|image
  payload     TEXT NOT NULL,               -- JSON
  model       TEXT,
  rag_sources TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(ref_key, kind)
);

-- ========== 讲道视频等外部资源（R-F） ==========
CREATE TABLE IF NOT EXISTS sermon_resources (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  speaker      TEXT,
  source       TEXT,                       -- 福音影视网 / B站 / YouTube ...
  url          TEXT NOT NULL,
  book_id      INTEGER NOT NULL,
  chapter      INTEGER NOT NULL,
  verse_start  INTEGER NOT NULL DEFAULT 1,
  verse_end    INTEGER NOT NULL DEFAULT 0,
  start_sec    INTEGER,                    -- 片段起点，用于"截取"该节的讲解
  end_sec      INTEGER,
  note         TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_res_ref ON sermon_resources(book_id, chapter);

-- ========== 可选知识库（讲道稿/书摘），供出题取材 R-E3 ==========
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  category   TEXT,                         -- 讲道稿 | 书摘 | 诗歌 | 时事
  content    TEXT NOT NULL,
  tags       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
