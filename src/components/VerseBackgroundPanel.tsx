'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import type { VerseBackground } from '@/lib/insights';
import type { RagSource } from '@/lib/rag-sources';
import { scheduleAutoBackgroundDismiss } from '@/lib/auto-background';
import { useBackgroundJobs } from './BackgroundJobsProvider';
import RagSourcesFootnote from './RagSourcesFootnote';

const SECTIONS: { key: keyof VerseBackground; title: string }[] = [
  { key: 'era', title: '时代与处境' },
  { key: 'place_people', title: '地点与人物' },
  { key: 'custom', title: '习俗与制度' },
  { key: 'parallel', title: '同期可参考' },
  { key: 'for_verse', title: '如何帮助读本节' },
];

export default function VerseBackgroundPanel({
  book,
  chapter,
  verse,
  label,
  onBusyChange,
  onPresent,
  onBackgroundDismiss,
}: {
  book: number;
  chapter: number;
  verse: number;
  label: string;
  onBusyChange?: (busy: boolean) => void;
  onPresent?: () => void;
  onBackgroundDismiss?: () => void;
}) {
  const { runJob, jobs } = useBackgroundJobs();
  const [data, setData] = useState<VerseBackground | null>(null);
  const [ragSources, setRagSources] = useState<RagSource[] | undefined>();
  const [probing, setProbing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const q = `kind=background&book=${book}&chapter=${chapter}&verse=${verse}`;
  const jobLabel = `背景 ${label}`;
  const jobRunning = jobs.some((j) => j.label === jobLabel && j.status === 'running');
  const displayBusy = busy || jobRunning;

  useEffect(() => {
    let alive = true;
    setData(null);
    setRagSources(undefined);
    setError('');
    setProbing(true);
    api<{ data: VerseBackground | null; ragSources?: RagSource[] }>(`/api/insights?${q}&cacheOnly=1`)
      .then((res) => {
        if (!alive) return;
        if (res.data) {
          setData(res.data);
          setRagSources(res.ragSources);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setProbing(false);
      });
    return () => {
      alive = false;
    };
  }, [q]);

  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  async function generate(regenerate = false) {
    setError('');
    setBusy(true);

    const refresh = regenerate ? '&refresh=1' : '';
    const rect = panelRef.current?.getBoundingClientRect();
    const throwFrom = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + 40 }
      : undefined;

    const { promise } = runJob({
      label: jobLabel,
      throwFrom,
      recovery: { kind: 'insights', query: q },
      task: () =>
        api<{ data: VerseBackground; ragSources?: RagSource[] }>(`/api/insights?${q}${refresh}`),
      onSuccess: (res) => {
        setData(res.data);
        setRagSources(res.ragSources);
      },
      onError: (err) => setError(err.message),
      present: () => {
        onPresent?.();
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
    });

    scheduleAutoBackgroundDismiss(onBackgroundDismiss);

    try {
      await promise;
    } catch {
      /* onError */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={panelRef} className="space-y-4">
      <p className="text-[12px] leading-relaxed text-muted">
        由 AI 结合固定历史类书库（犹太古史、教会史等）整理，供读节文时参考；若与教会传统理解有出入，请以经文与教牧指导为准。
      </p>

      {probing && !data && (
        <p className="py-6 text-center text-sm text-muted">正在查看是否已有背景…</p>
      )}

      {!probing && !data && !displayBusy && (
        <button type="button" className="btn-primary w-full" onClick={() => void generate()}>
          生成这一节的圣经背景
        </button>
      )}

      {displayBusy && !data && (
        <p className="py-6 text-center text-sm text-muted">正在检索书库并整理…</p>
      )}

      {error && <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">{error}</p>}

      {data && (
        <div className="space-y-3">
          {SECTIONS.map(({ key, title }) =>
            data[key]?.trim() ? (
              <section key={key} className="rounded-xl border border-line bg-surface/60 px-3 py-2.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-brand-600">{title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-ink/90">{data[key]}</p>
              </section>
            ) : null,
          )}
          <RagSourcesFootnote sources={ragSources} />
          <button
            type="button"
            className="btn-ghost w-full text-sm"
            disabled={displayBusy}
            onClick={() => void generate(true)}
          >
            {displayBusy ? '生成中…' : '重新生成'}
          </button>
        </div>
      )}
    </div>
  );
}
