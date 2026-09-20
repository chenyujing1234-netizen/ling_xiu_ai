'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import RagSourcesFootnote from './RagSourcesFootnote';
import type { RagSource } from '@/lib/rag-sources';

function ReviewSheet({
  refLabel,
  text,
  ragSources,
  onClose,
}: {
  refLabel: string;
  text: string;
  ragSources?: RagSource[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-ink/40 fade-in" onClick={onClose} aria-hidden />
      <div className="sheet z-[60] max-h-[75vh] overflow-y-auto px-5 pb-6">
        <div className="pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <p className="text-[15px] font-semibold">同行者点评</p>
          <p className="mt-0.5 text-xs text-muted">关于你在 {refLabel} 的笔记</p>
        </div>
        <div className="mt-4 rounded-xl bg-brand-50/80 px-4 py-3.5">
          <p className="whitespace-pre-wrap text-[15px] leading-[1.85] text-ink/90">{text}</p>
          <RagSourcesFootnote sources={ragSources} />
        </div>
        <button type="button" className="btn-primary mt-5 w-full py-3" onClick={onClose}>
          好的
        </button>
      </div>
    </>
  );
}

export default function NoteReviewBlock({
  noteId,
  refLabel,
  disabled,
  compact,
}: {
  noteId: number;
  refLabel: string;
  /** 例如笔记未保存、无文字 */
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function loadReview() {
    setErr('');
    setBusy(true);
    try {
      let res = await api<{ review: string | null; cached: boolean; ragSources?: RagSource[] }>(
        `/api/notes/${noteId}/review?cacheOnly=1`,
        { method: 'POST' },
      );
      if (!res.review?.trim()) {
        res = await api<{ review: string | null; cached: boolean; ragSources?: RagSource[] }>(
          `/api/notes/${noteId}/review`,
          { method: 'POST' },
        );
      }
      if (!res.review?.trim()) {
        setErr('暂时无法生成点评，稍后再试');
        return;
      }
      setReview(res.review);
      setRagSources(res.ragSources ?? []);
      setOpen(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={loadReview}
        className={
          compact
            ? 'mt-1 text-[12px] font-medium text-brand-600 active:opacity-70 disabled:opacity-40'
            : 'mt-2 w-full rounded-lg border border-brand-200 bg-brand-50/60 py-2 text-sm font-medium text-brand-700 active:opacity-80 disabled:opacity-40'
        }
      >
        {busy ? '同行者在读你的笔记…' : '同行者点评'}
      </button>
      {err && <p className="mt-1 text-[11px] text-accent">{err}</p>}
      {open && review && (
        <ReviewSheet
          refLabel={refLabel}
          text={review}
          ragSources={ragSources}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
