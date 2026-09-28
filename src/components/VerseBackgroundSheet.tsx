'use client';

import SheetModal from './SheetModal';
import type { VerseTarget } from './NoteSheet';
import VerseBackgroundPanel from './VerseBackgroundPanel';

export default function VerseBackgroundSheet({
  target,
  onClose,
  onReopen,
}: {
  target: VerseTarget;
  onClose: () => void;
  onReopen: (target: VerseTarget) => void;
}) {
  const ref = `${target.bookName} ${target.chapter}:${target.verse}`;

  return (
    <SheetModal onClose={onClose}>
      <div className="sticky top-0 z-10 bg-card px-5 pb-0 pt-3 pr-12">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="min-w-0">
          <p className="chip">圣经背景 · {ref}</p>
          <p className="scripture mt-2 line-clamp-3 text-[15px] text-ink/85">{target.cn}</p>
        </div>
      </div>
      <div className="px-5 pb-6">
        <VerseBackgroundPanel
          book={target.bookId}
          chapter={target.chapter}
          verse={target.verse}
          label={ref}
          onPresent={() => onReopen(target)}
          onBackgroundDismiss={onClose}
        />
      </div>
    </SheetModal>
  );
}
