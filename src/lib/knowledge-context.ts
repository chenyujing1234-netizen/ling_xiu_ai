import { db } from './db';
import { retrieveBookRagContext, type BookRagRetrieveInput } from './book-rag';
import { mergeRagSources, type RagSource } from './rag-sources';

export type KnowledgeForLlmResult = {
  /** 注入提示词的完整知识块（book_rag + 本站资料） */
  knowledge: string;
  /** 用于 UI 展示的 book_rag 知识库引用 */
  ragSources: RagSource[];
};

/** 站内 knowledge_docs 表（管理员上传的补充资料） */
async function localKnowledgeDocs(): Promise<{ text: string; source: RagSource | null }> {
  const rows = await db()
    .prepare(`SELECT title, category, content FROM knowledge_docs ORDER BY id DESC LIMIT 5`)
    .all<{ title: string; category: string | null; content: string }>();
  if (!rows.length) return { text: '', source: null };
  const text = rows.map((r) => `【${r.category ?? '资料'}】${r.title}\n${r.content.slice(0, 500)}`).join('\n\n');
  return { text, source: { id: 'local:knowledge_docs', name: '本站补充资料' } };
}

/**
 * 供 LLM 使用的知识上下文：优先 book_rag 检索，再叠加本地 knowledge_docs。
 */
export async function knowledgeForLlm(input: BookRagRetrieveInput): Promise<KnowledgeForLlmResult> {
  const [rag, local] = await Promise.all([retrieveBookRagContext(input), localKnowledgeDocs()]);
  const knowledge = [rag.text, local.text].filter((s) => s.trim()).join('\n\n---\n\n');
  const ragSources = mergeRagSources(rag.sources, local.text && local.source ? [local.source] : []);
  return { knowledge, ragSources };
}

/** @deprecated 请用 knowledgeForLlm */
export async function knowledgeSnippets(input: BookRagRetrieveInput = {}): Promise<string> {
  return (await knowledgeForLlm(input)).knowledge;
}
