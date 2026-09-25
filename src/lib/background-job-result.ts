import type { RagSource } from '@/lib/rag-sources';

export type JobResultView =
  | { kind: 'image'; url: string; caption: string }
  | { kind: 'text'; title: string; body: string; ragSources?: RagSource[]; isError?: boolean }
  | { kind: 'questions'; title: string; items: string[] };

/** 把 runJob 的返回值转成可在任务列表里直接展示的视图 */
export function parseJobResult(label: string, data: unknown): JobResultView | null {
  if (data == null) return null;
  if (typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  const nested = d.data;
  if (nested && typeof nested === 'object' && typeof (nested as { url?: unknown }).url === 'string') {
    const url = (nested as { url: string }).url;
    if (url) return { kind: 'image', url, caption: label };
  }

  if (typeof d.review === 'string' && d.review.trim()) {
    return {
      kind: 'text',
      title: label,
      body: d.review.trim(),
      ragSources: (d.ragSources as RagSource[] | undefined) ?? undefined,
    };
  }

  if (typeof d.feedback === 'string' && d.feedback.trim()) {
    return {
      kind: 'text',
      title: label,
      body: d.feedback.trim(),
      ragSources: (d.feedbackRagSources as RagSource[] | undefined) ?? undefined,
    };
  }

  if (Array.isArray(d.questions) && d.questions.every((q) => typeof q === 'string')) {
    return { kind: 'questions', title: label, items: d.questions as string[] };
  }

  if (typeof nested === 'string' && nested.trim()) {
    return { kind: 'text', title: label, body: nested.trim() };
  }

  return null;
}
