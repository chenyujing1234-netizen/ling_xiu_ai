'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { NoteReviewedBadge } from '@/components/Ui';
import RagSourcesFootnote from './RagSourcesFootnote';
import SheetModal from './SheetModal';
import type { RagSource } from '@/lib/rag-sources';

function SummarySheet({
  refLabel,
  text,
  noteCount,
  ragSources,
  onClose,
}: {
  refLabel: string;
  text: string;
  noteCount: number;
  ragSources?: RagSource[];
  onClose: () => void;
}) {
  return (
    <SheetModal onClose={onClose} zBackdrop={85} zSheet={95} className="max-h-[75vh]">
      <div className="px-5 pb-6">
        <div className="pt-3 pr-10">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <p className="text-[15px] font-semibold">本章笔记总结点评</p>
          <p className="mt-0.5 text-xs text-muted">
            {refLabel} · 共 {noteCount} 条文字笔记
          </p>
        </div>
        <div className="mt-4 rounded-xl bg-brand-50/80 px-4 py-3.5">
          <p className="whitespace-pre-wrap text-[15px] leading-[1.85] text-ink/90">{text}</p>
          <RagSourcesFootnote sources={ragSources} />
        </div>
      </div>
    </SheetModal>
  );
}

export default function ChapterNotesReviewBlock({
  bookId,
  chapter,
  bookName,
  textNoteCount,
  chapterReviewed,
}: {
  bookId: number;
  chapter: number;
  bookName: string;
  textNoteCount: number;
  chapterReviewed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [noteCount, setNoteCount] = useState(textNoteCount);
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reviewed, setReviewed] = useState(Boolean(chapterReviewed));

  const refLabel = `${bookName} ${chapter}章`;

  useEffect(() => {
    setReviewed(Boolean(chapterReviewed));
  }, [chapterReviewed, bookId, chapter]);

  if (textNoteCount < 1) return null;

  async function loadSummary() {
    setErr('');
    setBusy(true);
    try {
      let res = await api<{
        review: string | null;
        cached: boolean;
        ragSources?: RagSource[];
        noteCount: number;
      }>(`/api/notes/chapter-review?book=${bookId}&chapter=${chapter}&cacheOnly=1`, { method: 'POST' });
      if (!res.review?.trim()) {
        res = await api<{
          review: string | null;
          cached: boolean;
          ragSources?: RagSource[];
          noteCount: number;
        }>(`/api/notes/chapter-review?book=${bookId}&chapter=${chapter}`, { method: 'POST' });
      }
      if (!res.review?.trim()) {
        setErr('暂时无法生成总结，稍后再试');
        return;
      }
      setReview(res.review);
      setNoteCount(res.noteCount);
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
      <div className="mx-4 mb-2 flex items-center gap-1.5">
        {reviewed && <NoteReviewedBadge />}
        <button
          type="button"
          disabled={busy}
          onClick={loadSummary}
          className="btn-secondary flex-1 py-2 text-xs"
        >
          {busy ? '陪读者在读本章笔记…' : reviewed ? '再看本章笔记总结' : '本章笔记总结点评'}
        </button>
      </div>
      {err && <p className="mx-4 mb-2 text-[11px] text-accent">{err}</p>}
      {open && review && (
        <SummarySheet
          refLabel={refLabel}
          text={review}
          noteCount={noteCount}
          ragSources={ragSources}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
