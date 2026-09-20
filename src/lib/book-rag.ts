/**
 * book_rag（WeKnora）书本知识库检索。
 * 文档：https://github.com/chenyujing1234-netizen/book_rag
 *
 * 只调用 hybrid-search，不用服务端 knowledge-chat，避免消耗书库主人的模型额度。
 */

type KnowledgeBase = { id: string; name: string; chunk_count?: number };

type SearchHit = {
  content: string;
  score?: number;
  knowledge_id?: string;
  chunk_id?: string;
  kb_id?: string;
  kb_name?: string;
};

export type BookRagRetrieveInput = {
  /** 如「创世记 3:1-24」 */
  ref?: string;
  /** 经卷中文名，如「创世记」 */
  bookName?: string;
  /** 经文正文节选 */
  passage?: string;
  /** 用户输入、笔记、提问等，用于检索关键词 */
  focus?: string;
};

const BASE = () => (process.env.BOOK_RAG_BASE_URL || 'http://124.222.77.32:8081/api/v1').replace(/\/$/, '');
const API_KEY = () => process.env.BOOK_RAG_API_KEY || '';
const TOP_K = () => Math.min(Math.max(Number(process.env.BOOK_RAG_TOP_K) || 5, 1), 12);
const MAX_KBS = () => Math.min(Math.max(Number(process.env.BOOK_RAG_MAX_KBS) || 3, 1), 6);
const MAX_CHARS = () => Math.min(Math.max(Number(process.env.BOOK_RAG_MAX_CHARS) || 3600, 500), 12000);
const TIMEOUT_MS = () => Math.min(Math.max(Number(process.env.BOOK_RAG_TIMEOUT_MS) || 12000, 3000), 30000);

let kbCache: { at: number; items: KnowledgeBase[] } | null = null;
const KB_CACHE_MS = 30 * 60 * 1000;

export function bookRagConfigured(): boolean {
  if (process.env.BOOK_RAG_ENABLED === '0' || process.env.BOOK_RAG_ENABLED === 'false') return false;
  return Boolean(API_KEY());
}

function bookNameFromRef(ref?: string): string {
  if (!ref) return '';
  const m = ref.match(/^([\u4e00-\u9fff·]+)/);
  return m?.[1]?.replace(/·.*$/, '') ?? '';
}

function buildQuery(input: BookRagRetrieveInput): string {
  const book = input.bookName || bookNameFromRef(input.ref);
  const parts = [book, input.ref, input.focus?.trim(), input.passage?.trim().slice(0, 500)].filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').slice(0, 600);
}

function scoreKbName(name: string, hints: string[]): number {
  let score = 0;
  for (const h of hints) {
    if (!h || h.length < 2) continue;
    if (name.includes(h)) score += 12;
    else if (h.length >= 3 && name.includes(h.slice(0, 3))) score += 4;
  }
  if (hints.some((h) => /[\u4e00-\u9fff]/.test(h))) {
    if (/注释|研经|圣经|释义|概论|词典|查经/.test(name)) score += 3;
  }
  return score;
}

function pickKnowledgeBaseIds(kbs: KnowledgeBase[], input: BookRagRetrieveInput): string[] {
  const book = input.bookName || bookNameFromRef(input.ref);
  const hints = [...new Set([book, input.ref ?? '', ...(input.focus?.match(/[\u4e00-\u9fff]{2,}/g) ?? [])])].filter(
    Boolean,
  );

  const ranked = kbs
    .map((kb) => ({ id: kb.id, score: scoreKbName(kb.name, hints) }))
    .sort((a, b) => b.score - a.score);

  const picked = ranked.filter((x) => x.score > 0).slice(0, MAX_KBS()).map((x) => x.id);
  if (picked.length) return picked;

  const fallback =
    kbs.find((k) => k.name.includes('和合本')) ??
    kbs.find((k) => k.name.includes('圣经')) ??
    kbs[0];
  return fallback ? [fallback.id] : [];
}

async function weknoraFetch(path: string, init?: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS());
  try {
    return await fetch(`${BASE()}${path}`, {
      ...init,
      signal: ctl.signal,
      headers: {
        'X-API-Key': API_KEY(),
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  if (kbCache && Date.now() - kbCache.at < KB_CACHE_MS) return kbCache.items;
  try {
    const res = await weknoraFetch('/knowledge-bases');
    if (!res.ok) {
      console.warn(`[book-rag] 列出知识库失败 HTTP ${res.status}`);
      return kbCache?.items ?? [];
    }
    const body = (await res.json()) as { success?: boolean; data?: KnowledgeBase[] };
    const items = Array.isArray(body.data) ? body.data : [];
    kbCache = { at: Date.now(), items };
    return items;
  } catch (err) {
    console.warn(`[book-rag] 列出知识库异常: ${(err as Error).message}`);
    return kbCache?.items ?? [];
  }
}

async function hybridSearch(kbId: string, queryText: string): Promise<SearchHit[]> {
  try {
    const res = await weknoraFetch(`/knowledge-bases/${kbId}/hybrid-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_text: queryText, top_k: TOP_K() }),
    });
    if (!res.ok) {
      console.warn(`[book-rag] 检索失败 ${kbId} HTTP ${res.status}`);
      return [];
    }
    const body = (await res.json()) as { data?: SearchHit[] };
    const hits = Array.isArray(body.data) ? body.data : [];
    return hits.slice(0, TOP_K());
  } catch (err) {
    console.warn(`[book-rag] 检索异常 ${kbId}: ${(err as Error).message}`);
    return [];
  }
}

function formatHits(hits: SearchHit[], kbNameById: Map<string, string>): string {
  const max = MAX_CHARS();
  const lines: string[] = [];
  let used = 0;

  const sorted = [...hits].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  for (const h of sorted) {
    const text = (h.content ?? '').trim();
    if (!text) continue;
    const kbName = h.kb_name ?? (h.kb_id ? kbNameById.get(h.kb_id) : '') ?? '书库';
    const header = `—— 来自「${kbName}」${h.score != null ? `（相关度 ${h.score.toFixed(4)}）` : ''} ——\n`;
    const chunk = text.slice(0, Math.min(900, max - used - header.length));
    if (chunk.length < 40) continue;
    const block = header + chunk + (text.length > chunk.length ? '…' : '');
    if (used + block.length > max) break;
    lines.push(block);
    used += block.length + 2;
  }

  return lines.join('\n\n');
}

export type BookRagRetrieveResult = {
  text: string;
  /** 实际命中并写入提示词的知识库 */
  sources: { id: string; name: string }[];
};

function sourcesFromHits(hits: SearchHit[], kbNameById: Map<string, string>): { id: string; name: string }[] {
  const max = MAX_CHARS();
  const sorted = [...hits].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const used = new Map<string, string>();
  let total = 0;

  for (const h of sorted) {
    const text = (h.content ?? '').trim();
    if (!text) continue;
    const kbId = h.kb_id ?? '';
    const kbName = h.kb_name ?? (kbId ? kbNameById.get(kbId) : '') ?? '书库';
    const header = `—— 来自「${kbName}」${h.score != null ? `（相关度 ${h.score.toFixed(4)}）` : ''} ——\n`;
    const chunk = text.slice(0, Math.min(900, max - total - header.length));
    if (chunk.length < 40) continue;
    const blockLen = header.length + chunk.length + 2;
    if (total + blockLen > max) break;
    total += blockLen;
    if (kbId) used.set(kbId, kbName);
  }

  return [...used.entries()].map(([id, name]) => ({ id, name }));
}

/** 从 book_rag 检索与当前经文/用户输入相关的书摘，供 LLM 参考 */
export async function retrieveBookRagContext(input: BookRagRetrieveInput): Promise<BookRagRetrieveResult> {
  const empty = { text: '', sources: [] as { id: string; name: string }[] };
  if (!bookRagConfigured()) return empty;

  const query = buildQuery(input);
  if (query.length < 4) return empty;

  const kbs = await listKnowledgeBases();
  if (!kbs.length) return empty;

  const kbNameById = new Map(kbs.map((k) => [k.id, k.name]));
  const ids = pickKnowledgeBaseIds(kbs, input);
  if (!ids.length) return empty;

  const results = await Promise.all(ids.map((id) => hybridSearch(id, query)));
  const hits: SearchHit[] = [];
  for (let i = 0; i < ids.length; i++) {
    const kbId = ids[i];
    const kbName = kbNameById.get(kbId) ?? '';
    for (const h of results[i]) {
      hits.push({ ...h, kb_id: kbId, kb_name: kbName });
    }
  }

  return {
    text: formatHits(hits, kbNameById),
    sources: sourcesFromHits(hits, kbNameById),
  };
}
