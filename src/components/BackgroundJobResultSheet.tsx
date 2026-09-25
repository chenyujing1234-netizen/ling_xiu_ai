'use client';

import SheetModal from './SheetModal';
import RagSourcesFootnote from './RagSourcesFootnote';
import type { JobResultView } from '@/lib/background-job-result';

/** 从任务列表点「查看」时，在顶层展示结果（不依赖原页面是否还挂着） */
export default function BackgroundJobResultSheet({
  view,
  onClose,
}: {
  view: JobResultView;
  onClose: () => void;
}) {
  const title =
    view.kind === 'image' ? view.caption : view.kind === 'questions' ? view.title : view.title;

  return (
    <SheetModal onClose={onClose} zBackdrop={210} zSheet={220}>
      <div className="sticky top-0 z-10 bg-card px-5 pb-2 pt-3 pr-12">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <p className="chip line-clamp-2">{title}</p>
      </div>
      <div className="px-5 pb-6 pt-2">
        {view.kind === 'image' && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={view.url}
              alt={view.caption}
              width={1024}
              height={1024}
              decoding="async"
              className="aspect-square w-full rounded-2xl border border-line bg-line/30 object-cover"
            />
            <figcaption className="mt-2 text-center text-xs text-muted">
              AI 依经文生成的画面 · 长按图片可保存
            </figcaption>
          </figure>
        )}

        {view.kind === 'text' && (
          <div
            className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
              view.isError ? 'bg-accent/10 text-accent' : 'bg-paper text-ink'
            }`}
          >
            <p className="whitespace-pre-wrap">{view.body}</p>
            {!view.isError && <RagSourcesFootnote sources={view.ragSources} />}
          </div>
        )}

        {view.kind === 'questions' && (
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink">
            {view.items.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        )}
      </div>
    </SheetModal>
  );
}
