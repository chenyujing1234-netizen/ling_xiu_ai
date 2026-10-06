'use client';

import SheetModal from './SheetModal';
import type { VerseTarget } from './NoteSheet';
import VerseCommentaryPanel from './VerseCommentaryPanel';

/** 单节圣经注释（马唐纳，本地文本直读） */
export default function VerseCommentarySheet({
  target,
  onClose,
}: {
  target: VerseTarget;
  onClose: () => void;
}) {
  const ref = `${target.bookName} ${target.chapter}:${target.verse}`;

  return (
    <SheetModal onClose={onClose} fullScreen>
      <div className="sticky top-0 z-10 bg-card px-5 pb-0 pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="min-w-0">
          <p className="chip">圣经注释 · {ref}</p>
          <p className="scripture mt-2 line-clamp-3 text-[15px] text-ink/85">{target.cn}</p>
        </div>
      </div>
      <div className="px-5 pb-6">
        <VerseCommentaryPanel book={target.bookId} chapter={target.chapter} verse={target.verse} />
      </div>
    </SheetModal>
  );
}
