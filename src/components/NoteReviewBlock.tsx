'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { NoteReviewedBadge } from '@/components/Ui';
import RagSourcesFootnote from './RagSourcesFootnote';
import SheetModal from './SheetModal';
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
    <SheetModal onClose={onClose} zBackdrop={85} zSheet={95} className="max-h-[75vh]">
      <div className="px-5 pb-6">
        <div className="pt-3 pr-10">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <p className="text-[15px] font-semibold">陪读者点评</p>
          <p className="mt-0.5 text-xs text-muted">关于你在 {refLabel} 的笔记</p>
        </div>
        <div className="mt-4 rounded-xl bg-brand-50/80 px-4 py-3.5">
          <p className="whitespace-pre-wrap text-[15px] leading-[1.85] text-ink/90">{text}</p>
          <RagSourcesFootnote sources={ragSources} />
        </div>
      </div>
    </SheetModal>
  );
}

export default function NoteReviewBlock({
  noteId,
  refLabel,
  disabled,
  compact,
  readerReviewed,
}: {
  noteId: number;
  refLabel: string;
  /** 例如笔记未保存、无文字 */
  disabled?: boolean;
  compact?: boolean;
  /** 服务端：当前正文已有缓存点评 */
  readerReviewed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reviewed, setReviewed] = useState(Boolean(readerReviewed));

  useEffect(() => {
    setReviewed(Boolean(readerReviewed));
  }, [readerReviewed, noteId]);

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
      setReviewed(true);
      setOpen(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`flex items-center gap-1.5 ${compact ? 'mt-1' : 'mt-3'}`}>
        {reviewed && !disabled && <NoteReviewedBadge />}
        <button
          type="button"
          disabled={disabled || busy}
          onClick={loadReview}
          className={
            compact
              ? 'btn-secondary !w-auto self-start px-2.5 py-1 text-[11px]'
              : 'btn-secondary flex-1 py-2.5'
          }
        >
          {busy ? '陪读者在读你的笔记…' : reviewed ? '再看陪读者点评' : '陪读者点评'}
        </button>
      </div>
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
