import { db } from './db';
import { chatJson, MODELS, aiConfigured, generateImage } from './ai';
import {
  elementsPrompt,
  contextPrompt,
  graphPrompt,
  mindmapPrompt,
  imagePromptFor,
  imagePromptFromText,
} from './prompts';
import { getBook, getRange, passageText, refKey, refLabel, contextWindow, getVerse } from './bible';
import { saveSceneImage } from './media';
import { parseRagSources, serializeRagSources, type RagSource } from './rag-sources';
import { knowledgeForLlm } from './knowledge-context';

// ---------- 类型 ----------

export type Elements = {
  people: { name: string; role: string }[];
  times: { label: string; note: string }[];
  places: { name: string; note: string }[];
  plot: string[];
  climax: { verse: number; why: string };
  background: string;
  contemporary: { scripture: string[]; world: string[] };
  thesis: string;
  reflection: string[];
};

export type ContextInsight = {
  before_effect: string;
  after_effect: string;
  hinge: string;
  misread: string;
  cn_en: string;
};

export type GraphData = {
  nodes: { id: string; label: string; type: string; note?: string }[];
  edges: { from: string; to: string; label: string; weight?: number }[];
};

export type MindmapNode = { label: string; children?: MindmapNode[] };

// ---------- 缓存 ----------

async function readCache<T>(key: string, kind: string): Promise<T | null> {
  const row = await db()
    .prepare(`SELECT payload FROM passage_insights WHERE ref_key = ? AND kind = ?`)
    .get<{ payload: string }>(key, kind);
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

async function readRagSources(key: string, kind: string): Promise<RagSource[]> {
  const row = await db()
    .prepare(`SELECT rag_sources FROM passage_insights WHERE ref_key = ? AND kind = ?`)
    .get<{ rag_sources: string | null }>(key, kind);
  return parseRagSources(row?.rag_sources);
}

async function writeCache(
  key: string,
  kind: string,
  payload: unknown,
  model: string,
  ragSources?: RagSource[],
) {
  const ragJson = serializeRagSources(ragSources);
  await db()
    .prepare(
      `INSERT INTO passage_insights (ref_key, kind, payload, model, rag_sources) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), model = VALUES(model),
       rag_sources = VALUES(rag_sources), created_at = NOW()`,
    )
    .run(key, kind, JSON.stringify(payload), model, ragJson);
}

export async function clearCache(key: string) {
  await db().prepare(`DELETE FROM passage_insights WHERE ref_key = ?`).run(key);
}

function contextKey(bookId: number, chapter: number, verse: number) {
  return `${bookId}-${chapter}-${verse}-ctx`;
}

/**
 * 这一段的某类洞察是否已经生成过。
 *
 * 给前端用来"复原"已生成的内容：进面板时先问一句有没有，有就直接取回来显示，
 * 没有才让用户点生成。只查库，绝不触发 AI 调用。
 */
export async function isCached(
  bookId: number,
  chapter: number,
  kind: string,
  opts: { from?: number; to?: number; verse?: number } = {},
): Promise<boolean> {
  const key =
    opts.verse !== undefined
      ? contextKey(bookId, chapter, opts.verse)
      : (await resolveRange(bookId, chapter, opts.from ?? 1, opts.to ?? 0)).key;
  return (await readCache(key, kind)) !== null;
}

/** 只读缓存（含 RAG 引用来源），不触发 AI */
export async function readCachedInsight<T>(
  bookId: number,
  chapter: number,
  kind: string,
  opts: { from?: number; to?: number; verse?: number } = {},
): Promise<InsightResult<T> | null> {
  const key =
    opts.verse !== undefined
      ? contextKey(bookId, chapter, opts.verse)
      : (await resolveRange(bookId, chapter, opts.from ?? 1, opts.to ?? 0)).key;
  const data = await readCache<T>(key, kind);
  if (!data) return null;
  return { data, ragSources: await readRagSources(key, kind) };
}

export type InsightResult<T> = { data: T; ragSources: RagSource[] };

/** 统一入口：先查缓存，miss 才调 AI（R-C5 控制成本） */
async function cached<T>(
  key: string,
  kind: string,
  produce: () => Promise<{ data: T; ragSources: RagSource[] }>,
  force = false,
): Promise<InsightResult<T>> {
  if (!force) {
    const hit = await readCache<T>(key, kind);
    if (hit) return { data: hit, ragSources: await readRagSources(key, kind) };
  }
  const fresh = await produce();
  await writeCache(key, kind, fresh.data, MODELS.fast(), fresh.ragSources);
  return fresh;
}

// ---------- 段落范围助手 ----------

export async function resolveRange(bookId: number, chapter: number, from = 1, to = 0) {
  const verses = await getRange(bookId, chapter, from, to || 999);
  const start = verses[0]?.verse ?? from;
  const end = verses[verses.length - 1]?.verse ?? from;
  return {
    verses,
    from: start,
    to: end,
    key: refKey(bookId, chapter, start, end),
    label: await refLabel(bookId, chapter, start, end),
    genre: (await getBook(bookId))?.genre ?? '叙事',
  };
}

// ---------- 各类洞察 ----------

export async function getElements(
  bookId: number,
  chapter: number,
  from = 1,
  to = 0,
  force = false,
): Promise<InsightResult<Elements>> {
  const r = await resolveRange(bookId, chapter, from, to);
  return cached<Elements>(
    r.key,
    'elements',
    async () => {
      if (!aiConfigured()) throw new Error('AI 未配置，无法生成结构化梳理');
      const passageCn = passageText(r.verses, 'cn');
      const knowledgeCtx = await knowledgeForLlm({ ref: r.label, passage: passageCn });
      const data = await chatJson<Elements>(
        [
          { role: 'system', content: '你是熟悉圣经历史背景与古代近东研究的助手，只输出 JSON。' },
          {
            role: 'user',
            content: elementsPrompt({
              ref: r.label,
              passage: passageCn,
              genre: r.genre,
              knowledge: knowledgeCtx.knowledge,
            }),
          },
        ],
        { model: MODELS.fast(), maxTokens: 9000 },
      );
      return { data, ragSources: knowledgeCtx.ragSources };
    },
    force,
  );
}

export async function getContextInsight(
  bookId: number,
  chapter: number,
  verse: number,
  force = false,
): Promise<InsightResult<ContextInsight>> {
  const key = contextKey(bookId, chapter, verse);
  return cached<ContextInsight>(
    key,
    'context',
    async () => {
      if (!aiConfigured()) throw new Error('AI 未配置，无法生成上下文分析');
      // 目标节与上下文窗口互不依赖，一起取
      const [target, { before, after }] = await Promise.all([
        getVerse(bookId, chapter, verse),
        contextWindow(bookId, chapter, verse, 10),
      ]);
      const ref = await refLabel(bookId, chapter, verse);
      const verseText = `${target?.cn ?? ''}${target?.en ? `\n[EN] ${target.en}` : ''}`;
      const knowledgeCtx = await knowledgeForLlm({
        ref,
        passage: verseText,
        focus: passageText(before, 'cn') + passageText(after, 'cn'),
      });
      const data = await chatJson<ContextInsight>(
        [
          { role: 'system', content: '你熟悉圣经文学结构与释经学，只输出 JSON。' },
          {
            role: 'user',
            content: contextPrompt({
              ref,
              verseText,
              before: passageText(before, 'cn'),
              after: passageText(after, 'cn'),
              knowledge: knowledgeCtx.knowledge,
            }),
          },
        ],
        { model: MODELS.fast(), maxTokens: 9000 },
      );
      return { data, ragSources: knowledgeCtx.ragSources };
    },
    force,
  );
}

export async function getGraph(
  bookId: number,
  chapter: number,
  from = 1,
  to = 0,
  force = false,
): Promise<InsightResult<GraphData>> {
  const r = await resolveRange(bookId, chapter, from, to);
  return cached<GraphData>(
    r.key,
    'graph',
    async () => {
      if (!aiConfigured()) throw new Error('AI 未配置，无法生成知识图谱');
      const passageCn = passageText(r.verses, 'cn');
      const knowledgeCtx = await knowledgeForLlm({ ref: r.label, passage: passageCn });
      const data = await chatJson<GraphData>(
        [
          { role: 'system', content: '你擅长把叙事文本转成知识图谱，只输出 JSON。' },
          {
            role: 'user',
            content: graphPrompt({ ref: r.label, passage: passageCn, knowledge: knowledgeCtx.knowledge }),
          },
        ],
        { model: MODELS.fast(), maxTokens: 9000 },
      );
      // 丢弃指向不存在节点的边，避免前端力导向布局崩溃
      const ids = new Set(data.nodes.map((n) => n.id));
      data.edges = (data.edges ?? []).filter((e) => ids.has(e.from) && ids.has(e.to));
      return { data, ragSources: knowledgeCtx.ragSources };
    },
    force,
  );
}

export async function getMindmap(
  bookId: number,
  chapter: number,
  from = 1,
  to = 0,
  force = false,
): Promise<InsightResult<MindmapNode>> {
  const r = await resolveRange(bookId, chapter, from, to);
  return cached<MindmapNode>(
    r.key,
    'mindmap',
    async () => {
      if (!aiConfigured()) throw new Error('AI 未配置，无法生成思维导图');
      const passageCn = passageText(r.verses, 'cn');
      const knowledgeCtx = await knowledgeForLlm({ ref: r.label, passage: passageCn });
      const data = await chatJson<MindmapNode>(
        [
          { role: 'system', content: '你擅长把文本整理成层级清晰的思维导图，只输出 JSON。' },
          {
            role: 'user',
            content: mindmapPrompt({ ref: r.label, passage: passageCn, knowledge: knowledgeCtx.knowledge }),
          },
        ],
        { model: MODELS.fast(), maxTokens: 9000 },
      );
      return { data, ragSources: knowledgeCtx.ragSources };
    },
    force,
  );
}

/** 把供图链接下载落地，返回本站地址（链接 23 小时后失效，不能直接存库） */
async function persistImage(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`配图下载失败（HTTP ${res.status}）`);
  const buf = Buffer.from(await res.arrayBuffer());
  return await saveSceneImage(buf, /\.jpe?g(\?|$)/i.test(remoteUrl) ? 'jpg' : 'png');
}

/** 意境配图：依赖 elements 里的主题与地点 */
export async function getSceneImage(
  bookId: number,
  chapter: number,
  from = 1,
  to = 0,
): Promise<{ url: string | null }> {
  const r = await resolveRange(bookId, chapter, from, to);
  const hit = await readCache<{ url: string | null }>(r.key, 'image');
  // 只认落地后的本站地址；早期缓存过的外部临时链接已失效，重新生成
  if (hit?.url?.startsWith('/')) return hit;
  if (!MODELS.image()) return { url: null };

  // 他自己圈的一小段：原文本来就短，直接交给画图模型 —— 比先跑一遍要素梳理快一半，
  // 也更贴合圈中的这几节。整章太长塞不进提示词，仍走要素梳理那条路。
  const text = r.verses.map((v) => `${v.verse} ${v.cn}`).join(' ');
  const isPick = r.verses.length <= 12 && text.length <= 700;

  let prompt: string;
  if (isPick) {
    prompt = imagePromptFromText(r.label, text);
  } else {
    let thesis = r.label;
    let places: string[] = [];
    try {
      const el = await getElements(bookId, chapter, from, to);
      thesis = el.data.thesis || thesis;
      places = (el.data.places ?? []).map((p) => p.name).slice(0, 3);
    } catch {
      /* 没有 elements 也能出图，只是提示词弱一些 */
    }
    prompt = imagePromptFor(r.label, thesis, places);
  }
  const remote = await generateImage(prompt);
  if (!remote) return { url: null };

  const payload = { url: await persistImage(remote) };
  await writeCache(r.key, 'image', payload, MODELS.image());
  return payload;
}
