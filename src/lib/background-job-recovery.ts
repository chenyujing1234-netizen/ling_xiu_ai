import { api } from '@/lib/client';
import { parseJobResult } from '@/lib/background-job-result';

export type JobRecovery =
  | { kind: 'insights'; query: string }
  | { kind: 'noteReview'; noteId: number }
  | { kind: 'chapterReview'; bookId: number; chapter: number }
  | { kind: 'devotionPrompts'; devotionId: number }
  | { kind: 'devotionScore'; devotionId: number }
  | { kind: 'devotionCoach'; devotionId: number }
  | { kind: 'devotionNudge'; book: number; chapter: number };

/** 轮询直到服务端结果就绪；未就绪返回 null */
export async function pollJobRecovery(recovery: JobRecovery): Promise<unknown | null> {
  switch (recovery.kind) {
    case 'insights': {
      const res = await api<unknown>(`/api/insights?${recovery.query}&cacheOnly=1`);
      return insightsCacheHit(res) ? res : null;
    }
    case 'noteReview': {
      const res = await api<{ review?: string | null }>(
        `/api/notes/${recovery.noteId}/review?cacheOnly=1`,
        { method: 'POST' },
      );
      return res.review?.trim() ? res : null;
    }
    case 'chapterReview': {
      const res = await api<{ review?: string | null }>(
        `/api/notes/chapter-review?book=${recovery.bookId}&chapter=${recovery.chapter}&cacheOnly=1`,
        { method: 'POST' },
      );
      return res.review?.trim() ? res : null;
    }
    case 'devotionPrompts': {
      const d = await api<{ prompts?: unknown[] }>(`/api/devotion/${recovery.devotionId}`);
      return d.prompts?.length ? { prompts: d.prompts } : null;
    }
    case 'devotionScore': {
      const d = await api<{
        devotion?: { score?: number; unlocked?: number };
        scores?: unknown[];
      }>(`/api/devotion/${recovery.devotionId}`);
      if (d.scores?.length && d.devotion) {
        return {
          total: d.devotion.score ?? 0,
          unlocked: Boolean(d.devotion.unlocked),
          scores: d.scores,
        };
      }
      return null;
    }
    case 'devotionCoach': {
      const d = await api<{ coach?: { role: string; content: string }[] }>(
        `/api/devotion/${recovery.devotionId}`,
      );
      const msg = d.coach?.find((m) => m.role === 'coach' && m.content?.trim());
      return msg ? { guideReady: true, content: msg.content } : null;
    }
    case 'devotionNudge': {
      try {
        const res = await api<{ questions?: string[] }>(
          `/api/devotion/nudge?book=${recovery.book}&chapter=${recovery.chapter}`,
        );
        return res.questions?.length ? res : null;
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
}

function insightsCacheHit(res: unknown): boolean {
  if (!res || typeof res !== 'object') return false;
  const d = res as { data?: unknown; kind?: string };
  if (d.data === null || d.data === undefined) return false;
  if (typeof d.data === 'object' && d.data !== null && 'url' in d.data) {
    return Boolean((d.data as { url?: string | null }).url);
  }
  return true;
}

export function jobResultDisplayable(label: string, data: unknown): boolean {
  if (parseJobResult(label, data)) return true;
  if (!data || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.prompts) && o.prompts.length) return true;
  if (typeof o.guideReady === 'boolean') return true;
  if (Array.isArray(o.questions) && o.questions.length) return true;
  if (typeof o.total === 'number') return true;
  return false;
}

/** 页面刷新后无原 task 闭包时，按 recovery 重新发起生成（与首次请求一致，非 cacheOnly） */
export function retryTaskFromRecovery(recovery: JobRecovery): (() => Promise<unknown>) | null {
  switch (recovery.kind) {
    case 'insights':
      return () => api(`/api/insights?${recovery.query}`);
    case 'noteReview':
      return async () => {
        const res = await api<{ review: string | null }>(`/api/notes/${recovery.noteId}/review`, {
          method: 'POST',
        });
        if (!res.review?.trim()) throw new Error('暂时无法生成点评，稍后再试');
        return res;
      };
    case 'chapterReview':
      return async () => {
        const res = await api<{ review: string | null }>(
          `/api/notes/chapter-review?book=${recovery.bookId}&chapter=${recovery.chapter}`,
          { method: 'POST' },
        );
        if (!res.review?.trim()) throw new Error('暂时无法生成总结，稍后再试');
        return res;
      };
    case 'devotionPrompts':
      return () =>
        api(`/api/devotion/${recovery.devotionId}/action`, { json: { action: 'prompts' } });
    case 'devotionScore':
      return () =>
        api(`/api/devotion/${recovery.devotionId}/action`, { json: { action: 'score' } });
    case 'devotionNudge':
      return () =>
        api<{ questions: string[] }>(
          `/api/devotion/nudge?book=${recovery.book}&chapter=${recovery.chapter}`,
        );
    case 'devotionCoach':
      return async () => {
        const res = await fetch(`/api/devotion/${recovery.devotionId}/guide-stream`, {
          method: 'POST',
        });
        if (!res.ok || !res.body) {
          const info = await res.json().catch(() => ({ error: '引导生成失败' }));
          throw new Error((info as { error?: string }).error ?? '引导生成失败');
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            const event = JSON.parse(line.slice(5).trim()) as { type?: string; message?: string };
            if (event.type === 'error') {
              throw new Error(event.message ?? '引导生成失败');
            }
          }
        }
        return { guideReady: true };
      };
    default:
      return null;
  }
}

export function devotionRecoveryForAction(
  action: string,
  devotionId: number,
  bookId?: number,
  chapter?: number,
): JobRecovery | undefined {
  switch (action) {
    case 'prompts':
      return { kind: 'devotionPrompts', devotionId };
    case 'score':
      return { kind: 'devotionScore', devotionId };
    case 'guide':
    case 'coach':
      return { kind: 'devotionCoach', devotionId };
    default:
      return undefined;
  }
}
