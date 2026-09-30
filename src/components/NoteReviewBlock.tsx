'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { NoteReviewedBadge } from '@/components/Ui';
import RagSourcesFootnote from './RagSourcesFootnote';
import SheetModal from './SheetModal';
import { useBackgroundJobs } from './BackgroundJobsProvider';
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
    <SheetModal onClose={onClose} fullScreen>
      <div className="px-5 pb-6">
        <div className="sticky top-0 z-10 bg-card pt-1 pb-2">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <p className="text-[15px] font-semibold">陪读者点评</p>
          <p className="mt-0.5 text-xs text-muted">关于你在 {refLabel} 的笔记</p>
        </div>
        <div className="mt-4 rounded-xl bg-brand-50/80 px-4 py-3.5">
          <p className="whitespace-pre-wrap text-[15px] leading-[1.85] text-ink/90">{text}</p>
          <RagSourcesFootnote sources={ragSources} />
        </div>
        <button
          type="button"
          className="mt-5 w-full rounded-xl border border-line bg-card py-3.5 text-[15px] font-bold text-brand-700 active:bg-brand-50"
          onClick={onClose}
        >
          完成
        </button>
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
  disabled?: boolean;
  compact?: boolean;
  readerReviewed?: boolean;
}) {
  const { runJob } = useBackgroundJobs();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [queued, setQueued] = useState(false);
  const [err, setErr] = useState('');
  const [reviewed, setReviewed] = useState(Boolean(readerReviewed));
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setReviewed(Boolean(readerReviewed));
  }, [readerReviewed, noteId]);

  function loadReview() {
    setErr('');
    setQueued(true);

    const rect = btnRef.current?.getBoundingClientRect();
    const throwFrom = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : undefined;

    const { promise } = runJob({
      label: `笔记点评 ${refLabel}`,
      throwFrom,
      recovery: { kind: 'noteReview', noteId },
      task: async () => {
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
        if (!res.review?.trim()) throw new Error('暂时无法生成点评，稍后再试');
        return res;
      },
      onSuccess: (res) => {
        setReview(res.review!);
        setRagSources(res.ragSources ?? []);
        setReviewed(true);
      },
      onError: (e) => setErr(e.message),
      present: () => setOpen(true),
    });

    void promise.catch(() => {});
  }

  return (
    <>
      <div className={`flex flex-col gap-1.5 ${compact ? 'mt-1' : 'mt-3'}`}>
        <div className="flex items-center gap-1.5">
          {reviewed && !disabled && <NoteReviewedBadge />}
          <button
            ref={btnRef}
            type="button"
            disabled={disabled}
            onClick={() => void loadReview()}
            className={
              compact
                ? 'btn-secondary !w-auto self-start px-2.5 py-1 text-[11px]'
                : 'btn-secondary flex-1 py-2.5'
            }
          >
            {reviewed ? '再看陪读者点评' : '陪读者点评'}
          </button>
        </div>
        {queued && (
          <p className="text-[10px] text-brand-700">已转入后台，请看右上角红点袋；完成后会自动弹出点评</p>
        )}
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
