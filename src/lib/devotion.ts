import { createHash } from 'crypto';
import { db, today, transaction } from './db';
import { chat, chatJson, chatStream, MODELS, aiConfigured, type StreamEvent } from './ai';
import {
  questionPrompt,
  scorePrompt,
  guidePrompt,
  nudgePrompt,
  coachTurnPrompt,
  stageFeedbackPrompt,
  COACH_PERSONA,
} from './prompts';
import {
  fallbackQuestions,
  fallbackScore,
  fallbackGuide,
  fallbackNudges,
  fallbackStageFeedback,
} from './fallback';
import { resolveRange } from './insights';
import { passageText } from './bible';
import { knowledgeForLlm } from './knowledge-context';
import { parseRagSources, serializeRagSources, type RagSource } from './rag-sources';

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

export const UNLOCK_SCORE = () => Number(process.env.DEVOTION_UNLOCK_SCORE || 40);

// 推理模型光思考就要烧 1000-2800 token，给结构化任务留足预算。
// 实测评分任务（整章经文 + 四维度理由）在 6000 会被截断，所以给到 9000。
const TOKENS_JSON = 9000;
const TOKENS_PROSE = 6000;

/** 记录降级原因 —— 否则线上只会看到"离线评估"，查不出到底哪里断了 */
function logDegrade(scene: string, err: unknown) {
  console.warn(`[ai:degraded] ${scene}: ${(err as Error)?.message ?? String(err)}`);
}

// 各阶段的最低输入门槛 —— 这是"不能敷衍"的硬约束
/** 观察阶段：有一条有效输入即可进入下一步 */
export const MIN_OBSERVATION_ENTRIES = 1;
export const MIN_QUESTIONS = 2;
export const MIN_ANSWER_CHARS = 20;

// ---------- 会话 ----------

export async function getOrCreateDevotion(
  userId: number,
  bookId: number,
  chapter: number,
  from = 1,
  to = 0,
): Promise<Devotion> {
  const conn = db();
  const existing = await conn
    .prepare(
      `SELECT * FROM devotions
       WHERE user_id = ? AND book_id = ? AND chapter = ? AND verse_start = ? AND verse_end = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get<Devotion>(userId, bookId, chapter, from, to);
  if (existing) return existing;

  const info = await conn
    .prepare(
      `INSERT INTO devotions (user_id, day, book_id, chapter, verse_start, verse_end)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, today(), bookId, chapter, from, to);
  return (await conn
    .prepare(`SELECT * FROM devotions WHERE id = ?`)
    .get<Devotion>(info.lastInsertRowid))!;
}

export async function getDevotion(id: number, userId: number): Promise<Devotion | undefined> {
  return await db()
    .prepare(`SELECT * FROM devotions WHERE id = ? AND user_id = ?`)
    .get<Devotion>(id, userId);
}

export async function inputsOf(devotionId: number, kind?: string): Promise<DevotionInput[]> {
  const conn = db();
  return kind
    ? await conn
        .prepare(`SELECT * FROM devotion_inputs WHERE devotion_id = ? AND kind = ? ORDER BY id`)
        .all<DevotionInput>(devotionId, kind)
    : await conn
        .prepare(`SELECT * FROM devotion_inputs WHERE devotion_id = ? ORDER BY id`)
        .all<DevotionInput>(devotionId);
}

export async function addInput(
  devotionId: number,
  kind: string,
  content: string,
  extra: { refVerse?: number | null; promptId?: number | null; mediaPath?: string | null } = {},
): Promise<number> {
  const info = await db()
    .prepare(
      `INSERT INTO devotion_inputs (devotion_id, kind, content, ref_verse, prompt_id, media_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(devotionId, kind, content, extra.refVerse ?? null, extra.promptId ?? null, extra.mediaPath ?? null);
  await touch(devotionId);
  return Number(info.lastInsertRowid);
}

export async function updateInput(inputId: number, devotionId: number, content: string) {
  const r = await db()
    .prepare(`UPDATE devotion_inputs SET content = ? WHERE id = ? AND devotion_id = ?`)
    .run(content, inputId, devotionId);
  if (!r.changes) throw new Error('记录不存在');
  await touch(devotionId);
}

export async function setStage(devotionId: number, stage: Stage) {
  await db().prepare(`UPDATE devotions SET stage = ? WHERE id = ?`).run(stage, devotionId);
  await touch(devotionId);
}

async function touch(devotionId: number) {
  await db().prepare(`UPDATE devotions SET updated_at = NOW() WHERE id = ?`).run(devotionId);
}

/** 校验能否从当前阶段前进 —— 服务端强制，前端隐藏不算约束 */
export async function canAdvance(d: Devotion): Promise<{ ok: boolean; reason?: string }> {
  const inputs = await inputsOf(d.id);
  const text = (kind: string) =>
    inputs.filter((i) => i.kind === kind).map((i) => i.content).join('\n');

  switch (d.stage) {
    case 'observe': {
      const n = inputs.filter((i) => i.kind === 'observation' && i.content.trim().length > 0).length;
      if (n < MIN_OBSERVATION_ENTRIES) {
        return { ok: false, reason: '先写下你看见的，至少一条' };
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
      const turns = await db()
        .prepare(`SELECT COUNT(*) n FROM coach_messages WHERE devotion_id = ? AND role = 'coach'`)
        .get<{ n: number }>(d.id);
      if (!turns?.n) return { ok: false, reason: '请先获取引导' };
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

export function prevStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  if (i <= 0) return null;
  return STAGES[i - 1];
}

/** 回到上一阶段；已写内容保留，便于修改后重新提交 */
export async function retreatStage(d: Devotion): Promise<Stage> {
  const prev = prevStage(d.stage);
  if (!prev) throw new Error('已经是第一步');
  if (d.stage === 'done') {
    await db()
      .prepare(`UPDATE devotions SET stage = ?, completed_at = NULL WHERE id = ?`)
      .run(prev, d.id);
    await touch(d.id);
  } else {
    await setStage(d.id, prev);
  }
  return prev;
}

export const FEEDBACK_ON_ADVANCE: Stage[] = ['observe', 'inquire', 'reflect', 'guided', 'life'];

export type FeedbackStage = (typeof FEEDBACK_ON_ADVANCE)[number];

/** 用于判断该步内容是否相对上次点评有改动 */
export async function stageContentFingerprint(d: Devotion, stage: Stage): Promise<string> {
  const inputs = await inputsOf(d.id);
  let payload = '';

  switch (stage) {
    case 'observe':
      payload = inputs
        .filter((i) => i.kind === 'observation')
        .map((i) => i.content.trim())
        .join('\n');
      break;
    case 'inquire':
      payload = inputs
        .filter((i) => i.kind === 'question')
        .map((i) => i.content.trim())
        .join('\n');
      break;
    case 'reflect':
      payload = [
        inputs
          .filter((i) => i.kind === 'answer')
          .map((i) => `${i.prompt_id ?? 0}:${i.content.trim()}`)
          .join('\n'),
        `score:${d.score}`,
        `unlocked:${d.unlocked}`,
      ].join('\n');
      break;
    case 'guided': {
      const msgs = await db()
        .prepare(
          `SELECT role, content FROM coach_messages WHERE devotion_id = ? AND role IN ('user','coach') ORDER BY id`,
        )
        .all<{ role: string; content: string }>(d.id);
      payload = msgs.map((m) => `${m.role}:${m.content.trim()}`).join('\n');
      break;
    }
    case 'life':
      payload = inputs
        .filter((i) => i.kind === 'life_fact')
        .map((i) => i.content.trim())
        .join('\n');
      break;
    default:
      payload = '';
  }

  return createHash('sha256').update(payload).digest('hex');
}

export async function getCachedStageFeedback(
  devotionId: number,
  stage: FeedbackStage,
): Promise<{ content_hash: string; feedback: string; rag_sources: string | null } | null> {
  const row = await db()
    .prepare(
      `SELECT content_hash, feedback, rag_sources FROM devotion_stage_feedback WHERE devotion_id = ? AND stage = ?`,
    )
    .get<{ content_hash: string; feedback: string; rag_sources: string | null }>(devotionId, stage);
  return row ?? null;
}

export async function saveStageFeedback(
  devotionId: number,
  stage: FeedbackStage,
  contentHash: string,
  feedback: string,
  ragSources?: RagSource[],
) {
  const ragJson = serializeRagSources(ragSources);
  await db()
    .prepare(
      `INSERT INTO devotion_stage_feedback (devotion_id, stage, content_hash, feedback, rag_sources)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         content_hash = VALUES(content_hash),
         feedback = VALUES(feedback),
         rag_sources = VALUES(rag_sources),
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(devotionId, stage, contentHash, feedback, ragJson);
}

export async function stageFeedbacksMap(
  devotionId: number,
): Promise<Partial<Record<FeedbackStage, string>>> {
  const rows = await db()
    .prepare(`SELECT stage, feedback FROM devotion_stage_feedback WHERE devotion_id = ?`)
    .all<{ stage: FeedbackStage; feedback: string }>(devotionId);
  const out: Partial<Record<FeedbackStage, string>> = {};
  for (const r of rows) {
    if (r.feedback?.trim()) out[r.stage] = r.feedback;
  }
  return out;
}

export async function stageFeedbackRagSourcesMap(
  devotionId: number,
): Promise<Partial<Record<FeedbackStage, RagSource[]>>> {
  const rows = await db()
    .prepare(`SELECT stage, rag_sources FROM devotion_stage_feedback WHERE devotion_id = ?`)
    .all<{ stage: FeedbackStage; rag_sources: string | null }>(devotionId);
  const out: Partial<Record<FeedbackStage, RagSource[]>> = {};
  for (const r of rows) {
    const src = parseRagSources(r.rag_sources);
    if (src.length) out[r.stage] = src;
  }
  return out;
}

/** 点「下一步」时，对刚完成这一步的输入做短评（advance 侧负责缓存命中则跳过） */
export async function stageFeedback(
  d: Devotion,
  fromStage: Stage,
): Promise<{ feedback: string | null; ragSources: RagSource[] }> {
  if (!FEEDBACK_ON_ADVANCE.includes(fromStage)) return { feedback: null, ragSources: [] };

  const inputs = await inputsOf(d.id);
  const r = await resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end);
  const passage = passageText(r.verses, 'cn').slice(0, 2800);

  let userContent = '';
  let extra = '';

  switch (fromStage) {
    case 'observe':
      userContent = inputs
        .filter((i) => i.kind === 'observation')
        .map((i) => i.content)
        .join('\n');
      break;
    case 'inquire':
      userContent = inputs
        .filter((i) => i.kind === 'question')
        .map((i) => i.content)
        .join('\n');
      break;
    case 'reflect':
      userContent = inputs
        .filter((i) => i.kind === 'answer')
        .map((i) => i.content)
        .join('\n\n');
      extra = [
        inputs.filter((i) => i.kind === 'question').length
          ? `他自己提的问题：\n${inputs
              .filter((i) => i.kind === 'question')
              .map((i) => i.content)
              .join('\n')}`
          : '',
        d.score ? `本次默想评估 ${d.score} 分` : '',
      ]
        .filter(Boolean)
        .join('\n');
      break;
    case 'guided': {
      const msgs = await db()
        .prepare(
          `SELECT role, content FROM coach_messages WHERE devotion_id = ? AND role IN ('user','coach') ORDER BY id`,
        )
        .all<{ role: string; content: string }>(d.id);
      userContent = msgs
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n');
      const coachText = msgs
        .filter((m) => m.role === 'coach')
        .map((m) => m.content)
        .join('\n\n');
      if (coachText) extra = `同行者说过的话（节选）：\n${coachText.slice(0, 1200)}`;
      if (!userContent.trim()) userContent = '（引导阶段用户没有追加对话，主要阅读了同行者的回应）';
      break;
    }
    case 'life':
      userContent = inputs
        .filter((i) => i.kind === 'life_fact')
        .map((i) => i.content)
        .join('\n');
      break;
    default:
      return { feedback: null, ragSources: [] };
  }

  const stageKey = fromStage as 'observe' | 'inquire' | 'reflect' | 'guided' | 'life';
  const passageCn = passageText(r.verses, 'cn');

  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    const ctx = await knowledgeForLlm({
      ref: r.label,
      passage: passageCn,
      focus: userContent,
    });
    const feedback = await chat(
      [
        { role: 'system', content: COACH_PERSONA },
        {
          role: 'user',
          content: stageFeedbackPrompt({
            stage: stageKey,
            ref: r.label,
            passage,
            userContent,
            extra: extra || undefined,
            knowledge: ctx.knowledge,
          }),
        },
      ],
      { model: MODELS.fast(), maxTokens: 550, temperature: 0.72 },
    );
    return { feedback, ragSources: ctx.ragSources };
  } catch (err) {
    logDegrade(`阶段点评(${fromStage})`, err);
    return {
      feedback: fallbackStageFeedback(stageKey, userContent.replace(/（引导阶段.*?）/, '')),
      ragSources: [],
    };
  }
}

// ---------- AI 环节 ----------

/** 生成四层思辨题（缓存到 devotion_prompts，避免每次刷新都重新出题） */
export async function ensurePrompts(d: Devotion): Promise<PromptRow[]> {
  const conn = db();
  const sel = conn.prepare(`SELECT * FROM devotion_prompts WHERE devotion_id = ? ORDER BY id`);
  const existing = await sel.all<PromptRow>(d.id);
  if (existing.length) return existing;

  const r = await resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end);
  let questions: { layer: string; bridge: string | null; question: string }[];

  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    const passageCn = passageText(r.verses, 'cn');
    const [knowledgeCtx, history] = await Promise.all([
      knowledgeForLlm({ ref: r.label, passage: passageCn }),
      userHistoryDigest(d.user_id, d.id),
    ]);
    const res = await chatJson<{ questions: typeof questions }>(
      [
        { role: 'system', content: '你是设计思辨性读经问题的专家，只输出 JSON。' },
        {
          role: 'user',
          content: questionPrompt({
            ref: r.label,
            passage: passageCn,
            genre: r.genre,
            knowledge: knowledgeCtx.knowledge,
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

  await transaction(async (tx) => {
    const insert = tx.prepare(
      `INSERT INTO devotion_prompts (devotion_id, layer, bridge, question) VALUES (?, ?, ?, ?)`,
    );
    for (const q of questions.slice(0, 6)) {
      await insert.run(d.id, q.layer || 'theology', q.bridge ?? null, q.question);
    }
  });

  return await sel.all<PromptRow>(d.id);
}

export type ScoreResult = {
  total: number;
  unlocked: boolean;
  scores: { dimension: string; score: number; reason: string }[];
  encouragement: string;
  degraded: boolean;
  ragSources: RagSource[];
};

export async function scoreDevotion(d: Devotion): Promise<ScoreResult> {
  const [r, inputs, promptRows] = await Promise.all([
    resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end),
    inputsOf(d.id),
    db()
      .prepare(`SELECT id, question FROM devotion_prompts WHERE devotion_id = ?`)
      .all<{ id: number; question: string }>(d.id),
  ]);
  const join = (kind: string) =>
    inputs.filter((i) => i.kind === kind).map((i, n) => `${n + 1}. ${i.content}`).join('\n');

  const observation = join('observation');
  const questions = join('question');
  const promptMap = new Map(promptRows.map((p) => [p.id, p.question]));
  const answers = inputs
    .filter((i) => i.kind === 'answer')
    .map((i) => `问：${promptMap.get(i.prompt_id ?? -1) ?? '（自问）'}\n答：${i.content}`)
    .join('\n\n');

  let result: { scores: ScoreResult['scores']; encouragement: string };
  let degraded = false;
  let scoreRagSources: RagSource[] = [];

  const passageCn = passageText(r.verses, 'cn');

  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    const knowledgeCtx = await knowledgeForLlm({
      ref: r.label,
      passage: passageCn,
      focus: [observation, questions, answers].join('\n'),
    });
    result = await chatJson(
      [
        { role: 'system', content: '你是灵修同行者，评估读者的投入质量，只输出 JSON。' },
        {
          role: 'user',
          content: scorePrompt({
            ref: r.label,
            passage: passageCn,
            observation,
            questions,
            answers,
            knowledge: knowledgeCtx.knowledge,
          }),
        },
      ],
      { model: MODELS.fast(), maxTokens: TOKENS_JSON, temperature: 0.3 },
    );
    if (!result.scores?.length) throw new Error('评分为空');
    scoreRagSources = knowledgeCtx.ragSources;
  } catch (err) {
    logDegrade('评分', err);
    result = fallbackScore({ observation, questions, answers, passage: passageText(r.verses, 'cn') });
    degraded = true;
    scoreRagSources = [];
  }

  const total = Math.round(
    result.scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / result.scores.length,
  );
  const unlocked = total >= UNLOCK_SCORE();

  await transaction(async (tx) => {
    await tx.prepare(`DELETE FROM devotion_scores WHERE devotion_id = ?`).run(d.id);
    const ins = tx.prepare(
      `INSERT INTO devotion_scores (devotion_id, dimension, score, reason) VALUES (?, ?, ?, ?)`,
    );
    for (const s of result.scores) {
      await ins.run(d.id, s.dimension, Math.round(Number(s.score) || 0), s.reason ?? '');
    }
    await tx
      .prepare(`UPDATE devotions SET score = ?, unlocked = ? WHERE id = ?`)
      .run(total, unlocked ? 1 : 0, d.id);
  });

  return {
    total,
    unlocked,
    scores: result.scores,
    encouragement: result.encouragement ?? '',
    degraded,
    ragSources: scoreRagSources,
  };
}

/** 组装引导所需的全部上下文（流式与非流式共用） */
async function guidanceMessages(d: Devotion) {
  const [r, inputs, noteRows, history] = await Promise.all([
    resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end),
    inputsOf(d.id),
    db()
      .prepare(
        `SELECT verse, content FROM verse_notes
         WHERE user_id = ? AND book_id = ? AND chapter = ? AND content <> '' ORDER BY verse`,
      )
      .all<{ verse: number; content: string }>(d.user_id, d.book_id, d.chapter),
    userHistoryDigest(d.user_id, d.id),
  ]);
  const join = (kind: string) => inputs.filter((i) => i.kind === kind).map((i) => i.content).join('\n');

  const notes = noteRows.map((n) => `第${n.verse}节：${n.content}`).join('\n');
  const passageCn = passageText(r.verses, 'cn');
  const knowledgeCtx = await knowledgeForLlm({
    ref: r.label,
    passage: passageCn,
    focus: [join('question'), join('answer'), notes].join('\n'),
  });

  return {
    label: r.label,
    questions: join('question'),
    ragSources: knowledgeCtx.ragSources,
    messages: [
      { role: 'system' as const, content: '你是灵修同行者。' },
      {
        role: 'user' as const,
        content: guidePrompt({
          ref: r.label,
          passage: passageCn,
          observation: join('observation'),
          questions: join('question'),
          answers: join('answer'),
          notes,
          history,
          knowledge: knowledgeCtx.knowledge,
        }),
      },
    ],
  };
}

async function saveGuidance(devotionId: number, text: string, ragSources?: RagSource[]) {
  const ragJson = serializeRagSources(ragSources);
  await db()
    .prepare(`INSERT INTO coach_messages (devotion_id, role, content, rag_sources) VALUES (?, 'coach', ?, ?)`)
    .run(devotionId, text, ragJson);
}

/** 引导揭晓（非流式，作为流式失败时的备用路径） */
export async function generateGuidance(d: Devotion): Promise<string> {
  const ctx = await guidanceMessages(d);
  let text: string;
  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    // 引导是产品最核心的输出，这里用主模型换质量
    text = await chat(ctx.messages, { model: MODELS.main(), maxTokens: TOKENS_PROSE, temperature: 0.75 });
  } catch (err) {
    logDegrade('引导', err);
    text = fallbackGuide(ctx.label, ctx.questions);
  }
  await saveGuidance(d.id, text, ctx.ragSources);
  return text;
}

/** 引导揭晓（流式）。逐段产出文本，结束后落库。 */
export async function* streamGuidance(
  d: Devotion,
): AsyncGenerator<StreamEvent | { type: 'done'; text: string; ragSources?: RagSource[] }> {
  const ctx = await guidanceMessages(d);
  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    for await (const event of chatStream(ctx.messages, {
      model: MODELS.main(),
      maxTokens: TOKENS_PROSE,
      temperature: 0.75,
    })) {
      if (event.type === 'done') {
        await saveGuidance(d.id, event.text, ctx.ragSources);
        yield { type: 'done', text: event.text, ragSources: ctx.ragSources };
      } else {
        yield event;
      }
    }
  } catch (err) {
    logDegrade('引导(流式)', err);
    const text = fallbackGuide(ctx.label, ctx.questions);
    await saveGuidance(d.id, text, ctx.ragSources);
    yield { type: 'delta', text };
    yield { type: 'done', text, ragSources: ctx.ragSources };
  }
}

/** 教练多轮对话 */
export async function coachReply(
  d: Devotion,
  userText: string,
): Promise<{ reply: string; ragSources: RagSource[] }> {
  const conn = db();
  await conn
    .prepare(`INSERT INTO coach_messages (devotion_id, role, content) VALUES (?, 'user', ?)`)
    .run(d.id, userText);

  const [r, history, inputs] = await Promise.all([
    resolveRange(d.book_id, d.chapter, d.verse_start, d.verse_end),
    conn
      .prepare(`SELECT role, content FROM coach_messages WHERE devotion_id = ? ORDER BY id`)
      .all<{ role: string; content: string }>(d.id),
    inputsOf(d.id),
  ]);
  const context = inputs.map((i) => `[${i.kind}] ${i.content}`).join('\n').slice(0, 3000);

  const passageCn = passageText(r.verses, 'cn');
  let reply: string;
  let ragSources: RagSource[] = [];
  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    const knowledgeCtx = await knowledgeForLlm({
      ref: r.label,
      passage: passageCn,
      focus: `${userText}\n${context}`,
    });
    ragSources = knowledgeCtx.ragSources;
    reply = await chat(
      [
        {
          role: 'system',
          content: coachTurnPrompt({
            ref: r.label,
            passage: passageCn,
            context,
            knowledge: knowledgeCtx.knowledge,
          }),
        },
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
    ragSources = [];
  }

  const ragJson = serializeRagSources(ragSources);
  await conn
    .prepare(`INSERT INTO coach_messages (devotion_id, role, content, rag_sources) VALUES (?, 'coach', ?, ?)`)
    .run(d.id, reply, ragJson);
  return { reply, ragSources };
}

/** 兜底追问：想结束却没有任何感悟时（R-D5） */
export async function generateNudges(bookId: number, chapter: number, from = 1, to = 0): Promise<string[]> {
  const r = await resolveRange(bookId, chapter, from, to);
  const passageCn = passageText(r.verses, 'cn');
  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    const knowledgeCtx = await knowledgeForLlm({ ref: r.label, passage: passageCn });
    const res = await chatJson<{ questions: string[] }>(
      [
        { role: 'system', content: '你是灵修同行者，只输出 JSON。' },
        {
          role: 'user',
          content: nudgePrompt({
            ref: r.label,
            passage: passageCn,
            genre: r.genre,
            knowledge: knowledgeCtx.knowledge,
          }),
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
export async function userHistoryDigest(
  userId: number,
  excludeDevotionId?: number,
): Promise<string> {
  const rows = await db()
    .prepare(
      `SELECT d.id, b.name_cn, d.chapter, i.kind, i.content
       FROM devotions d
       JOIN bible_books b ON b.id = d.book_id
       JOIN devotion_inputs i ON i.devotion_id = d.id
       WHERE d.user_id = ? AND d.id <> ? AND i.kind IN ('question','life_fact','prayer')
       ORDER BY d.id DESC LIMIT 24`,
    )
    .all<{ name_cn: string; chapter: number; kind: string; content: string }>(
      userId,
      excludeDevotionId ?? -1,
    );
  if (!rows.length) return '';
  const label: Record<string, string> = { question: '曾问', life_fact: '生命实事', prayer: '祷告' };
  return rows
    .map((r) => `${r.name_cn}${r.chapter}章 ${label[r.kind] ?? r.kind}：${r.content.slice(0, 90)}`)
    .join('\n');
}

/** 完成灵修，并把当天该章标记为"真正读过"（R-D6） */
export async function completeDevotion(d: Devotion) {
  await transaction(async (tx) => {
    await tx
      .prepare(`UPDATE devotions SET stage='done', completed_at=NOW() WHERE id=?`)
      .run(d.id);
    await tx
      .prepare(
        'INSERT INTO reading_logs (user_id, `day`, book_id, chapter, engaged) VALUES (?, ?, ?, ?, 1)' +
          ' ON DUPLICATE KEY UPDATE engaged = 1',
      )
      .run(d.user_id, today(), d.book_id, d.chapter);
  });
}
