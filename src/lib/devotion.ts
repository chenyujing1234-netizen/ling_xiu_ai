import { db, today } from './db';
import { chat, chatJson, chatStream, MODELS, aiConfigured, type StreamEvent } from './ai';
import { questionPrompt, scorePrompt, guidePrompt, nudgePrompt, coachTurnPrompt } from './prompts';
import { fallbackQuestions, fallbackScore, fallbackGuide, fallbackNudges } from './fallback';
import { resolveRange } from './insights';
import { passageText } from './bible';

/** 七个阶段，强制顺序推进（R-D） */
export const STAGES = ['observe', 'inquire', 'reflect', 'guided', 'life', 'prayer', 'done'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_META: Record<Stage, { title: string; hint: string }> = {
  observe: { title: '观察', hint: '先只写你看见的：谁、在哪里、什么时候、做了什么' },
  inquire: { title: '自己提问', hint: '不是回答问题，而是提出你自己的疑问' },
  reflect: { title: '默想作答', hint: '回答这些问题，用你自己的话' },
  guided: { title: '引导揭晓', hint: '同行者顺着你写的内容，带你往深处走' },
  life: { title: '生命实事', hint: '记下你生命里真实发生的事、看到的现象' },
  prayer: { title: '祷告回应', hint: '把话说回给神，这次灵修才算完整' },
  done: { title: '完成', hint: '归档，可随时回看' },
};

export type Devotion = {
  id: number;
  user_id: number;
  day: string;
  book_id: number;
  chapter: number;
  verse_start: number;
  verse_end: number;
  stage: Stage;
  score: number;
  unlocked: number;
  completed_at: string | null;
  created_at: string;
};

export type DevotionInput = {
  id: number;
  devotion_id: number;
  kind: string;
  content: string;
  ref_verse: number | null;
  prompt_id: number | null;
  media_path: string | null;
  created_at: string;
};

export type PromptRow = {
  id: number;
  devotion_id: number;
  layer: string;
  bridge: string | null;
  question: string;
};

export const UNLOCK_SCORE = () => Number(process.env.DEVOTION_UNLOCK_SCORE || 60);

// 推理模型光思考就要烧 1000-2800 token，给结构化任务留足预算。
// 实测评分任务（整章经文 + 四维度理由）在 6000 会被截断，所以给到 9000。
const TOKENS_JSON = 9000;
const TOKENS_PROSE = 6000;

/** 记录降级原因 —— 否则线上只会看到"离线评估"，查不出到底哪里断了 */
function logDegrade(scene: string, err: unknown) {
  console.warn(`[ai:degraded] ${scene}: ${(err as Error)?.message ?? String(err)}`);
}

// 各阶段的最低输入门槛 —— 这是"不能敷衍"的硬约束
export const MIN_OBSERVATION_CHARS = 30;
export const MIN_QUESTIONS = 2;
export const MIN_ANSWER_CHARS = 20;

// ---------- 会话 ----------

export function getOrCreateDevotion(
  userId: number,
  bookId: number,
  chapter: number,
  from = 1,
  to = 0,
): Devotion {
  const conn = db();
  const existing = conn
    .prepare(
      `SELECT * FROM devotions
       WHERE user_id = ? AND book_id = ? AND chapter = ? AND verse_start = ? AND verse_end = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(userId, bookId, chapter, from, to) as Devotion | undefined;
  if (existing) return existing;

  const info = conn
    .prepare(
      `INSERT INTO devotions (user_id, day, book_id, chapter, verse_start, verse_end)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, today(), bookId, chapter, from, to);
  return conn.prepare(`SELECT * FROM devotions WHERE id = ?`).get(info.lastInsertRowid) as Devotion;
}

export function getDevotion(id: number, userId: number): Devotion | undefined {
  return db()
    .prepare(`SELECT * FROM devotions WHERE id = ? AND user_id = ?`)
    .get(id, userId) as Devotion | undefined;
}

export function inputsOf(devotionId: number, kind?: string): DevotionInput[] {
  const conn = db();
  return (
    kind
      ? conn
          .prepare(`SELECT * FROM devotion_inputs WHERE devotion_id = ? AND kind = ? ORDER BY id`)
          .all(devotionId, kind)
      : conn.prepare(`SELECT * FROM devotion_inputs WHERE devotion_id = ? ORDER BY id`).all(devotionId)
  ) as DevotionInput[];
}

export function addInput(
  devotionId: number,
  kind: string,
  content: string,
  extra: { refVerse?: number | null; promptId?: number | null; mediaPath?: string | null } = {},
) {
  db()
    .prepare(
      `INSERT INTO devotion_inputs (devotion_id, kind, content, ref_verse, prompt_id, media_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(devotionId, kind, content, extra.refVerse ?? null, extra.promptId ?? null, extra.mediaPath ?? null);
  touch(devotionId);
}

export function setStage(devotionId: number, stage: Stage) {
  db().prepare(`UPDATE devotions SET stage = ? WHERE id = ?`).run(stage, devotionId);
  touch(devotionId);
}

function touch(devotionId: number) {
  db()
    .prepare(`UPDATE devotions SET updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(devotionId);
}

/** 校验能否从当前阶段前进 —— 服务端强制，前端隐藏不算约束 */
export function canAdvance(d: Devotion): { ok: boolean; reason?: string } {
  const inputs = inputsOf(d.id);
  const text = (kind: string) =>
    inputs.filter((i) => i.kind === kind).map((i) => i.content).join('\n');

  switch (d.stage) {
    case 'observe': {
      const chars = text('observation').replace(/\s/g, '').length;
      if (chars < MIN_OBSERVATION_CHARS) {
        return { ok: false, reason: `观察还需要再写 ${MIN_OBSERVATION_CHARS - chars} 字` };
      }
      return { ok: true };
    }
    case 'inquire': {
      const n = inputs.filter((i) => i.kind === 'question' && i.content.trim().length > 4).length;
      if (n < MIN_QUESTIONS) {
        return { ok: false, reason: `还需要你自己再提 ${MIN_QUESTIONS - n} 个问题` };
      }
      return { ok: true };
    }
    case 'reflect': {
      const answers = inputs.filter((i) => i.kind === 'answer');
      const chars = text('answer').replace(/\s/g, '').length;
      if (!answers.length || chars < MIN_ANSWER_CHARS) {
        return { ok: false, reason: '请先回答问题，写下你自己的想法' };
      }
      if (d.score < UNLOCK_SCORE() || !d.unlocked) {
        return { ok: false, reason: `评估分数需达到 ${UNLOCK_SCORE()} 分才会解锁引导` };
      }
      return { ok: true };
    }
    case 'guided': {
      const turns = db()
        .prepare(`SELECT COUNT(*) n FROM coach_messages WHERE devotion_id = ? AND role = 'coach'`)
        .get(d.id) as { n: number };
      if (!turns.n) return { ok: false, reason: '请先获取引导' };
      return { ok: true };
    }
    case 'life': {
      if (text('life_fact').replace(/\s/g, '').length < 10) {
        return { ok: false, reason: '写一件你生命里真实发生的事，哪怕只有一句' };
      }
      return { ok: true };
    }
    case 'prayer': {
      const prayers = inputs.filter((i) => i.kind === 'prayer');
      const hasVoice = prayers.some((p) => p.media_path);
      if (!hasVoice && text('prayer').replace(/\s/g, '').length < 10) {
        return { ok: false, reason: '写下或录下你的祷告，这次灵修才算完整' };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

export function nextStage(stage: Stage): Stage {
  const i = STAGES.indexOf(stage);
  return STAGES[Math.min(i + 1, STAGES.length - 1)];
}

// ---------- AI 环节 ----------

/** 生成四层思辨题（缓存到 devotion_prompts，避免每次刷新都重新出题） */
export async function ensurePrompts(d: Devotion): Promise<PromptRow[]> {
  const conn = db();
  const existing = conn
    .prepare(`SELECT * FROM devotion_prompts WHERE devotion_id = ? ORDER BY id`)
    .all(d.id) as PromptRow[];
  if (existing.length) return existing;

  const r = resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end);
  let questions: { layer: string; bridge: string | null; question: string }[];

  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    const knowledge = knowledgeSnippets();
    const history = userHistoryDigest(d.user_id, d.id);
    const res = await chatJson<{ questions: typeof questions }>(
      [
        { role: 'system', content: '你是设计思辨性读经问题的专家，只输出 JSON。' },
        {
          role: 'user',
          content: questionPrompt({
            ref: r.label,
            passage: passageText(r.verses, 'cn'),
            genre: r.genre,
            knowledge,
            history,
          }),
        },
      ],
      // 出题用快模型：实测 20-30 秒且 JSON 稳定，主模型要 70 秒，等待代价太高
      { model: MODELS.fast(), maxTokens: TOKENS_JSON, temperature: 0.8 },
    );
    questions = res.questions?.length ? res.questions : fallbackQuestions(r.label, r.genre);
  } catch (err) {
    logDegrade('出题', err);
    questions = fallbackQuestions(r.label, r.genre);
  }

  const insert = conn.prepare(
    `INSERT INTO devotion_prompts (devotion_id, layer, bridge, question) VALUES (?, ?, ?, ?)`,
  );
  conn.transaction(() => {
    for (const q of questions.slice(0, 6)) {
      insert.run(d.id, q.layer || 'theology', q.bridge ?? null, q.question);
    }
  })();

  return conn
    .prepare(`SELECT * FROM devotion_prompts WHERE devotion_id = ? ORDER BY id`)
    .all(d.id) as PromptRow[];
}

export type ScoreResult = {
  total: number;
  unlocked: boolean;
  scores: { dimension: string; score: number; reason: string }[];
  encouragement: string;
  degraded: boolean;
};

export async function scoreDevotion(d: Devotion): Promise<ScoreResult> {
  const r = resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end);
  const inputs = inputsOf(d.id);
  const join = (kind: string) =>
    inputs.filter((i) => i.kind === kind).map((i, n) => `${n + 1}. ${i.content}`).join('\n');

  const observation = join('observation');
  const questions = join('question');
  const promptMap = new Map(
    (db().prepare(`SELECT id, question FROM devotion_prompts WHERE devotion_id = ?`).all(d.id) as {
      id: number;
      question: string;
    }[]).map((p) => [p.id, p.question]),
  );
  const answers = inputs
    .filter((i) => i.kind === 'answer')
    .map((i) => `问：${promptMap.get(i.prompt_id ?? -1) ?? '（自问）'}\n答：${i.content}`)
    .join('\n\n');

  let result: { scores: ScoreResult['scores']; encouragement: string };
  let degraded = false;

  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    result = await chatJson(
      [
        { role: 'system', content: '你是灵修同行者，评估读者的投入质量，只输出 JSON。' },
        {
          role: 'user',
          content: scorePrompt({
            ref: r.label,
            passage: passageText(r.verses, 'cn'),
            observation,
            questions,
            answers,
          }),
        },
      ],
      { model: MODELS.fast(), maxTokens: TOKENS_JSON, temperature: 0.3 },
    );
    if (!result.scores?.length) throw new Error('评分为空');
  } catch (err) {
    logDegrade('评分', err);
    result = fallbackScore({ observation, questions, answers, passage: passageText(r.verses, 'cn') });
    degraded = true;
  }

  const total = Math.round(
    result.scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / result.scores.length,
  );
  const unlocked = total >= UNLOCK_SCORE();

  const conn = db();
  conn.transaction(() => {
    conn.prepare(`DELETE FROM devotion_scores WHERE devotion_id = ?`).run(d.id);
    const ins = conn.prepare(
      `INSERT INTO devotion_scores (devotion_id, dimension, score, reason) VALUES (?, ?, ?, ?)`,
    );
    for (const s of result.scores) {
      ins.run(d.id, s.dimension, Math.round(Number(s.score) || 0), s.reason ?? '');
    }
    conn
      .prepare(`UPDATE devotions SET score = ?, unlocked = ? WHERE id = ?`)
      .run(total, unlocked ? 1 : 0, d.id);
  })();

  return { total, unlocked, scores: result.scores, encouragement: result.encouragement ?? '', degraded };
}

/** 组装引导所需的全部上下文（流式与非流式共用） */
function guidanceMessages(d: Devotion) {
  const r = resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end);
  const inputs = inputsOf(d.id);
  const join = (kind: string) => inputs.filter((i) => i.kind === kind).map((i) => i.content).join('\n');

  const notes = (
    db()
      .prepare(
        `SELECT verse, content FROM verse_notes
         WHERE user_id = ? AND book_id = ? AND chapter = ? AND content <> '' ORDER BY verse`,
      )
      .all(d.user_id, d.book_id, d.chapter) as { verse: number; content: string }[]
  )
    .map((n) => `第${n.verse}节：${n.content}`)
    .join('\n');

  return {
    label: r.label,
    questions: join('question'),
    messages: [
      { role: 'system' as const, content: '你是灵修同行者。' },
      {
        role: 'user' as const,
        content: guidePrompt({
          ref: r.label,
          passage: passageText(r.verses, 'cn'),
          observation: join('observation'),
          questions: join('question'),
          answers: join('answer'),
          notes,
          history: userHistoryDigest(d.user_id, d.id),
        }),
      },
    ],
  };
}

function saveGuidance(devotionId: number, text: string) {
  db()
    .prepare(`INSERT INTO coach_messages (devotion_id, role, content) VALUES (?, 'coach', ?)`)
    .run(devotionId, text);
}

/** 引导揭晓（非流式，作为流式失败时的备用路径） */
export async function generateGuidance(d: Devotion): Promise<string> {
  const ctx = guidanceMessages(d);
  let text: string;
  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    // 引导是产品最核心的输出，这里用主模型换质量
    text = await chat(ctx.messages, { model: MODELS.main(), maxTokens: TOKENS_PROSE, temperature: 0.75 });
  } catch (err) {
    logDegrade('引导', err);
    text = fallbackGuide(ctx.label, ctx.questions);
  }
  saveGuidance(d.id, text);
  return text;
}

/** 引导揭晓（流式）。逐段产出文本，结束后落库。 */
export async function* streamGuidance(d: Devotion): AsyncGenerator<StreamEvent> {
  const ctx = guidanceMessages(d);
  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    for await (const event of chatStream(ctx.messages, {
      model: MODELS.main(),
      maxTokens: TOKENS_PROSE,
      temperature: 0.75,
    })) {
      if (event.type === 'done') saveGuidance(d.id, event.text);
      yield event;
    }
  } catch (err) {
    logDegrade('引导(流式)', err);
    const text = fallbackGuide(ctx.label, ctx.questions);
    saveGuidance(d.id, text);
    yield { type: 'delta', text };
    yield { type: 'done', text };
  }
}

/** 教练多轮对话 */
export async function coachReply(d: Devotion, userText: string): Promise<string> {
  const conn = db();
  conn
    .prepare(`INSERT INTO coach_messages (devotion_id, role, content) VALUES (?, 'user', ?)`)
    .run(d.id, userText);

  const r = resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end);
  const history = conn
    .prepare(`SELECT role, content FROM coach_messages WHERE devotion_id = ? ORDER BY id`)
    .all(d.id) as { role: string; content: string }[];
  const inputs = inputsOf(d.id);
  const context = inputs.map((i) => `[${i.kind}] ${i.content}`).join('\n').slice(0, 3000);

  let reply: string;
  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    reply = await chat(
      [
        { role: 'system', content: coachTurnPrompt({ ref: r.label, passage: passageText(r.verses, 'cn'), context }) },
        ...history.slice(-12).map((m) => ({
          role: (m.role === 'coach' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: m.content,
        })),
      ],
      { model: MODELS.main(), maxTokens: TOKENS_PROSE, temperature: 0.8 },
    );
  } catch (err) {
    logDegrade('教练对话', err);
    reply =
      '（AI 暂时不可用）你刚才说的这一点，如果放在你这一周最难的那件事上，会怎么样？先把它写下来，等服务恢复我们再往下走。';
  }

  conn
    .prepare(`INSERT INTO coach_messages (devotion_id, role, content) VALUES (?, 'coach', ?)`)
    .run(d.id, reply);
  return reply;
}

/** 兜底追问：想结束却没有任何感悟时（R-D5） */
export async function generateNudges(bookId: number, chapter: number, from = 1, to = 0): Promise<string[]> {
  const r = resolveRange(bookId, chapter, from, to);
  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    const res = await chatJson<{ questions: string[] }>(
      [
        { role: 'system', content: '你是灵修同行者，只输出 JSON。' },
        {
          role: 'user',
          content: nudgePrompt({ ref: r.label, passage: passageText(r.verses, 'cn'), genre: r.genre }),
        },
      ],
      { model: MODELS.fast(), maxTokens: TOKENS_JSON, temperature: 0.9 },
    );
    return res.questions?.length ? res.questions.slice(0, 3) : fallbackNudges(r.label);
  } catch (err) {
    logDegrade('兜底追问', err);
    return fallbackNudges(r.label);
  }
}

// ---------- 辅助 ----------

/** 用户过去的灵修痕迹摘要，让引导"因人而异"（R-D3） */
export function userHistoryDigest(userId: number, excludeDevotionId?: number): string {
  const rows = db()
    .prepare(
      `SELECT d.id, b.name_cn, d.chapter, i.kind, i.content
       FROM devotions d
       JOIN bible_books b ON b.id = d.book_id
       JOIN devotion_inputs i ON i.devotion_id = d.id
       WHERE d.user_id = ? AND d.id <> ? AND i.kind IN ('question','life_fact','prayer')
       ORDER BY d.id DESC LIMIT 24`,
    )
    .all(userId, excludeDevotionId ?? -1) as {
    name_cn: string;
    chapter: number;
    kind: string;
    content: string;
  }[];
  if (!rows.length) return '';
  const label: Record<string, string> = { question: '曾问', life_fact: '生命实事', prayer: '祷告' };
  return rows
    .map((r) => `${r.name_cn}${r.chapter}章 ${label[r.kind] ?? r.kind}：${r.content.slice(0, 90)}`)
    .join('\n');
}

/** 知识库取材（R-E3），无内容则返回空串，出题自动退回大众文化素材 */
export function knowledgeSnippets(): string {
  const rows = db()
    .prepare(`SELECT title, category, content FROM knowledge_docs ORDER BY id DESC LIMIT 5`)
    .all() as { title: string; category: string | null; content: string }[];
  if (!rows.length) return '';
  return rows.map((r) => `【${r.category ?? '资料'}】${r.title}\n${r.content.slice(0, 500)}`).join('\n\n');
}

/** 完成灵修，并把当天该章标记为"真正读过"（R-D6） */
export function completeDevotion(d: Devotion) {
  const conn = db();
  conn.transaction(() => {
    conn
      .prepare(`UPDATE devotions SET stage='done', completed_at=datetime('now','localtime') WHERE id=?`)
      .run(d.id);
    conn
      .prepare(
        `INSERT INTO reading_logs (user_id, day, book_id, chapter, engaged) VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(user_id, day, book_id, chapter) DO UPDATE SET engaged = 1`,
      )
      .run(d.user_id, today(), d.book_id, d.chapter);
  })();
}
