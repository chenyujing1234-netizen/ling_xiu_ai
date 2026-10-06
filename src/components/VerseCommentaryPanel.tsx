'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import type { VerseCommentary } from '@/lib/insights';
import type { RagSource } from '@/lib/rag-sources';
import RagSourcesFootnote from './RagSourcesFootnote';

/** 马唐纳注释：本地按章 txt 直读，打开即显示原文（无任务、不经 LLM） */
export default function VerseCommentaryPanel({
  book,
  chapter,
  verse,
}: {
  book: number;
  chapter: number;
  verse: number;
}) {
  const [data, setData] = useState<VerseCommentary | null>(null);
  const [ragSources, setRagSources] = useState<RagSource[] | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const q = `kind=commentary&source=macdonald&book=${book}&chapter=${chapter}&verse=${verse}`;

  useEffect(() => {
    let alive = true;
    setData(null);
    setRagSources(undefined);
    setError('');
    setLoading(true);
    api<{ data: VerseCommentary | null; ragSources?: RagSource[] }>(`/api/insights?${q}`)
      .then((res) => {
        if (!alive) return;
        setData(res.data);
        setRagSources(res.ragSources);
      })
      .catch((err) => {
        if (alive) setError(err?.message ?? '读取失败');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [q, tick]);

  const hasBody = Boolean(data?.body?.trim());

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-muted">
        摘自本地《马唐纳注释》按章文本，原文呈现与本节相关的注释；若与教会长久理解有出入，请以经文与教牧指导为准。
      </p>

      {loading && (
        <p className="py-6 text-center text-sm text-muted">正在读取注释…</p>
      )}

      {error && (
        <div className="space-y-2">
          <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">{error}</p>
          <button type="button" className="btn-ghost w-full text-sm" onClick={() => setTick((t) => t + 1)}>
            重试
          </button>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {data.note?.trim() && (
            <p className="rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-[13px] leading-relaxed text-muted">
              {data.note.trim()}
            </p>
          )}
          {hasBody && (
            <section className="rounded-xl border border-line bg-surface/60 px-3 py-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-brand-600">
                马唐纳 · 本节注释
              </h3>
              <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-ink/90">
                {data.body
                  .trim()
                  .split(/\n{2,}/)
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((p) => (
                    <p key={p.slice(0, 48)}>{p}</p>
                  ))}
              </div>
            </section>
          )}
          <RagSourcesFootnote sources={ragSources} label="摘录自" />
        </div>
      )}
    </div>
  );
}
