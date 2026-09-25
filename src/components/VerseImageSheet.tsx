'use client';

import VerseSceneImage from './VerseSceneImage';
import SheetModal from './SheetModal';
import type { VerseTarget } from './NoteSheet';

/** 单节经文配图：独立于笔记面板 */
export default function VerseImageSheet({
  target,
  onClose,
  onReopen,
}: {
  target: VerseTarget;
  onClose: () => void;
  /** 后台任务完成后再次弹出（父级需重新 set imageTarget） */
  onReopen: (target: VerseTarget) => void;
}) {
  const ref = `${target.bookName} ${target.chapter}:${target.verse}`;

  return (
    <SheetModal onClose={onClose}>
      <div className="sticky top-0 z-10 bg-card px-5 pb-0 pt-3 pr-12">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="min-w-0">
          <p className="chip">{ref}</p>
          <p className="scripture mt-2 line-clamp-3 text-[15px] text-ink/85">{target.cn}</p>
        </div>
      </div>
      <div className="px-5 pb-6">
        <VerseSceneImage
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
