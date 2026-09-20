-- 灵修AI 数据库结构（MySQL 8）
--
-- 与 SQLite 版的对应关系，改这个文件时要一并想清楚：
--   INTEGER PRIMARY KEY AUTOINCREMENT → INT AUTO_INCREMENT
--   TEXT（带索引或需默认值）         → VARCHAR(n)，长度按实测最长值留了余量
--   TEXT（正文、JSON）               → TEXT / LONGTEXT
--   TEXT 存的时间戳                  → DATETIME / DATE
--     连接层开了 dateStrings，读出来仍是 'YYYY-MM-DD HH:MM:SS' 字符串，
--     所以代码里 created_at.slice(0,16) 这类写法照旧能用。
--   datetime('now','localtime')      → CURRENT_TIMESTAMP
--     服务器时区与应用机一致（都是 CST），所以两边生成的时间可以混用。
--   布尔 0/1                         → TINYINT

-- ========== 认证：邀请制，无自助注册 ==========
CREATE TABLE IF NOT EXISTS users (
  id             INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone          VARCHAR(20)  NOT NULL,
  name           VARCHAR(50)  NOT NULL,
  password_hash  VARCHAR(200) NOT NULL,   -- scrypt$salt$hash，实测 168 字符
  role           VARCHAR(10)  NOT NULL DEFAULT 'member',   -- member | admin
  status         VARCHAR(10)  NOT NULL DEFAULT 'active',   -- active | disabled
  must_change_pw TINYINT      NOT NULL DEFAULT 1,          -- 首次登录强制改密
  church         VARCHAR(100) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at  DATETIME     NULL,
  last_path      VARCHAR(512) NULL,   -- 上次退出时的站内路径，下次登录恢复
  UNIQUE KEY uk_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 使用申请：用户提交 → 管理员审批 → 管理员线下把密码告诉他
CREATE TABLE IF NOT EXISTS access_requests (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone         VARCHAR(20)  NOT NULL,
  name          VARCHAR(50)  NOT NULL,
  church        VARCHAR(100) NULL,
  note          VARCHAR(500) NULL,
  status        VARCHAR(10)  NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   DATETIME     NULL,
  reviewed_by   INT          NULL,
  reject_reason VARCHAR(200) NULL,
  KEY idx_req_status (status, created_at DESC),
  CONSTRAINT fk_req_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 登录限流
CREATE TABLE IF NOT EXISTS login_attempts (
  id    INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  `ok`  TINYINT     NOT NULL,
  `at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attempt (phone, `at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== 圣经文本 ==========
CREATE TABLE IF NOT EXISTS bible_books (
  id        INT         NOT NULL PRIMARY KEY,   -- 1..66，手动指定不自增
  name_cn   VARCHAR(20) NOT NULL,
  name_en   VARCHAR(50) NOT NULL,
  abbr_cn   VARCHAR(10) NOT NULL,
  chapters  INT         NOT NULL,
  testament VARCHAR(2)  NOT NULL,               -- OT | NT
  genre     VARCHAR(10) NOT NULL                -- 律法/历史/诗歌/先知/福音/书信/预言
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bible_verses (
  book_id INT           NOT NULL,
  chapter INT           NOT NULL,
  verse   INT           NOT NULL,
  cn      VARCHAR(400)  NOT NULL DEFAULT '',    -- 实测最长 110 字
  en      VARCHAR(1200) NOT NULL DEFAULT '',    -- 实测最长 528 字
  PRIMARY KEY (book_id, chapter, verse),
  CONSTRAINT fk_verse_book FOREIGN KEY (book_id) REFERENCES bible_books(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== 读经 ==========
CREATE TABLE IF NOT EXISTS reading_settings (
  user_id        INT NOT NULL PRIMARY KEY,
  daily_chapters INT NOT NULL DEFAULT 4,
  cursor_book    INT NOT NULL DEFAULT 1,
  cursor_chapter INT NOT NULL DEFAULT 1,
  explore_book   INT NOT NULL DEFAULT 1,
  explore_chapter INT NOT NULL DEFAULT 1,
  theme          VARCHAR(32) NOT NULL DEFAULT 'classic',
  bilingual      TINYINT NOT NULL DEFAULT 1,
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 每天一条：记录读了哪些章，以及是否达成"真正读过"的判定（R-D6）
CREATE TABLE IF NOT EXISTS reading_logs (
  id        INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id   INT      NOT NULL,
  `day`     DATE     NOT NULL,
  book_id   INT      NOT NULL,
  chapter   INT      NOT NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  seconds   INT      NOT NULL DEFAULT 0,   -- 停留时长
  engaged   TINYINT  NOT NULL DEFAULT 0,   -- 是否有互动（笔记/灵修）
  UNIQUE KEY uk_log (user_id, `day`, book_id, chapter),
  KEY idx_log_user_day (user_id, `day` DESC),
  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== 灵修会话（七阶段，强制顺序） ==========
-- 放在 verse_notes 之前：后者的 devotion_id 外键指向这里
CREATE TABLE IF NOT EXISTS devotions (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      INT         NOT NULL,
  `day`        DATE        NOT NULL,
  book_id      INT         NOT NULL,
  chapter      INT         NOT NULL,
  verse_start  INT         NOT NULL DEFAULT 1,
  verse_end    INT         NOT NULL DEFAULT 0,        -- 0 = 到本章末
  stage        VARCHAR(10) NOT NULL DEFAULT 'observe',-- observe|inquire|reflect|guided|life|prayer|done
  score        INT         NOT NULL DEFAULT 0,
  unlocked     TINYINT     NOT NULL DEFAULT 0,        -- 是否已解锁引导揭晓
  completed_at DATETIME    NULL,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_dev_user (user_id, created_at DESC),
  CONSTRAINT fk_dev_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 逐节笔记：长按经文产生（文字 / 历史录音）
CREATE TABLE IF NOT EXISTS verse_notes (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  book_id     INT          NOT NULL,
  chapter     INT          NOT NULL,
  verse       INT          NOT NULL,
  kind        VARCHAR(12)  NOT NULL,          -- text | audio（audio 为历史数据，现在只写 text）
  content     TEXT         NULL,              -- 文字内容 / 录音转写文字
  media_path  VARCHAR(200) NULL,              -- 历史音频的相对路径
  duration_ms INT          NULL,
  god_spoke   TINYINT      NOT NULL DEFAULT 0,-- "这节神对我说话"
  devotion_id INT          NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_note_user (user_id, created_at DESC),
  KEY idx_note_verse (user_id, book_id, chapter, verse),
  CONSTRAINT fk_note_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_note_dev FOREIGN KEY (devotion_id) REFERENCES devotions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verse_note_reviews (
  note_id       INT NOT NULL PRIMARY KEY,
  content_hash  VARCHAR(64) NOT NULL,
  review        TEXT NOT NULL,
  rag_sources   TEXT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_note_review FOREIGN KEY (note_id) REFERENCES verse_notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户在各阶段的输入。kind 区分：
-- observation 观察 | question 自己的提问 | answer 作答 | life_fact 生命实事 | prayer 祷告
CREATE TABLE IF NOT EXISTS devotion_inputs (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  devotion_id INT          NOT NULL,
  kind        VARCHAR(20)  NOT NULL,
  content     TEXT         NOT NULL,
  ref_verse   INT          NULL,   -- 关联到某一节
  prompt_id   INT          NULL,   -- 若为 answer，对应哪道系统题
  media_path  VARCHAR(200) NULL,   -- 录音祷告等
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_input_dev (devotion_id, kind),
  CONSTRAINT fk_input_dev FOREIGN KEY (devotion_id) REFERENCES devotions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 系统生成的思辨题（R-D4 四个层次 / R-E 文化载体）
CREATE TABLE IF NOT EXISTS devotion_prompts (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  devotion_id INT          NOT NULL,
  layer       VARCHAR(20)  NOT NULL,   -- fact | flow | theology | application
  bridge      VARCHAR(200) NULL,       -- 引用的文化载体：歌曲/电影/名著/热点
  question    TEXT         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_prompt_dev (devotion_id),
  CONSTRAINT fk_prompt_dev FOREIGN KEY (devotion_id) REFERENCES devotions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 评分明细（多维度）
CREATE TABLE IF NOT EXISTS devotion_scores (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  devotion_id INT         NOT NULL,
  dimension   VARCHAR(20) NOT NULL,   -- observation|inquiry|thesis|personal
  score       INT         NOT NULL,
  reason      TEXT        NOT NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_score_dev (devotion_id, created_at DESC),
  CONSTRAINT fk_score_dev FOREIGN KEY (devotion_id) REFERENCES devotions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 引导式对话（AI 教练）
CREATE TABLE IF NOT EXISTS coach_messages (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  devotion_id INT         NOT NULL,
  role        VARCHAR(10) NOT NULL,   -- user | coach
  content     TEXT        NOT NULL,
  rag_sources TEXT NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_coach_dev (devotion_id, id),
  CONSTRAINT fk_coach_dev FOREIGN KEY (devotion_id) REFERENCES devotions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS devotion_stage_feedback (
  devotion_id   INT NOT NULL,
  stage         VARCHAR(16) NOT NULL,
  content_hash  VARCHAR(64) NOT NULL,
  feedback      TEXT NOT NULL,
  rag_sources   TEXT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (devotion_id, stage),
  CONSTRAINT fk_stage_fb_dev FOREIGN KEY (devotion_id) REFERENCES devotions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== 结构化洞察缓存（控制 AI 成本，R-C5） ==========
CREATE TABLE IF NOT EXISTS passage_insights (
  id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ref_key    VARCHAR(40) NOT NULL,   -- 如 "1-3-1-24"
  kind       VARCHAR(20) NOT NULL,   -- elements|context|timeline|graph|mindmap|image
  payload     LONGTEXT    NOT NULL,   -- JSON 字符串；不用 JSON 类型，免得驱动自动解析
  model       VARCHAR(60) NULL,
  rag_sources TEXT NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_insight (ref_key, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== 讲道视频等外部资源（R-F） ==========
CREATE TABLE IF NOT EXISTS sermon_resources (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  speaker     VARCHAR(50)  NULL,
  source      VARCHAR(50)  NULL,   -- 福音影视网 / B站 / YouTube ...
  url         VARCHAR(600) NOT NULL,
  book_id     INT          NOT NULL,
  chapter     INT          NOT NULL,
  verse_start INT          NOT NULL DEFAULT 1,
  verse_end   INT          NOT NULL DEFAULT 0,
  start_sec   INT          NULL,   -- 片段起点，用于"截取"该节的讲解
  end_sec     INT          NULL,
  note        VARCHAR(500) NULL,
  created_by  INT          NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_res_ref (book_id, chapter),
  CONSTRAINT fk_res_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== 可选知识库（讲道稿/书摘），供出题取材 R-E3 ==========
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(200) NOT NULL,
  category   VARCHAR(20)  NULL,   -- 讲道稿 | 书摘 | 诗歌 | 时事
  content    LONGTEXT     NOT NULL,
  tags       VARCHAR(200) NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
