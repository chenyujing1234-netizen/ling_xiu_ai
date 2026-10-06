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

  if (typeof d.total === 'number' && Array.isArray(d.scores)) {
    const lines = (d.scores as { dimension?: string; score?: number; reason?: string }[])
      .map((s) => `${s.dimension ?? ''}: ${s.score ?? '—'}${s.reason ? ` — ${s.reason}` : ''}`)
      .filter(Boolean);
    return {
      kind: 'text',
      title: label,
      body: [`总分 ${d.total}`, ...(lines.length ? ['', ...lines] : [])].join('\n'),
    };
  }

  if (typeof d.guideReady === 'boolean' && typeof d.content === 'string') {
    return { kind: 'text', title: label, body: d.content.trim() };
  }

  if (Array.isArray(d.prompts) && d.prompts.length) {
    return {
      kind: 'text',
      title: label,
      body: '默想思考题已生成。请回到灵修页查看并作答。',
    };
  }

  if (nested && typeof nested === 'object' && typeof (nested as { body?: unknown }).body === 'string') {
    const cm = nested as { body: string; note?: string };
    const parts = [cm.body?.trim(), cm.note?.trim()].filter(Boolean);
    if (parts.length) {
      return {
        kind: 'text',
        title: label,
        body: parts.join('\n\n'),
        ragSources: (d.ragSources as RagSource[] | undefined) ?? undefined,
      };
    }
  }

  if (nested && typeof nested === 'object' && typeof (nested as { era?: unknown }).era === 'string') {
    const bg = nested as {
      era: string;
      place_people: string;
      custom: string;
      parallel: string;
      for_verse: string;
    };
    const parts = [
      bg.era?.trim() && `【时代与处境】\n${bg.era.trim()}`,
      bg.place_people?.trim() && `【地点与人物】\n${bg.place_people.trim()}`,
      bg.custom?.trim() && `【习俗与制度】\n${bg.custom.trim()}`,
      bg.parallel?.trim() && `【同期可参考】\n${bg.parallel.trim()}`,
      bg.for_verse?.trim() && `【如何帮助读本节】\n${bg.for_verse.trim()}`,
    ].filter(Boolean);
    if (parts.length) {
      return {
        kind: 'text',
        title: label,
        body: parts.join('\n\n'),
        ragSources: (d.ragSources as RagSource[] | undefined) ?? undefined,
      };
    }
  }

  return null;
}
