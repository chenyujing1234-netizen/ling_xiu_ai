'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { scheduleAutoBackgroundDismiss } from '@/lib/auto-background';
import ImageStylePicker, { usePreferredImageStyle } from './ImageStylePicker';
import { useBackgroundJobs } from './BackgroundJobsProvider';

/**
 * 为某一节经文生成一张画面。与选段配图共用同一接口与缓存：
 * from=to=这一节时，第二次打开直接出图。
 */
export default function VerseSceneImage({
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
  const [url, setUrl] = useState<string | null>(null);
  const [probing, setProbing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [style, setStyle] = usePreferredImageStyle();
  const panelRef = useRef<HTMLDivElement>(null);

  const q = `book=${book}&chapter=${chapter}&from=${verse}&to=${verse}&style=${encodeURIComponent(style)}`;
  const jobLabel = `配图 ${label}`;
  const jobRunning = jobs.some((j) => j.label === jobLabel && j.status === 'running');
  const displayBusy = busy || jobRunning;

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setError('');
    setProbing(true);
    api<{ data: { url: string | null } | null }>(`/api/insights?kind=image&${q}&cacheOnly=1`)
      .then((res) => {
        if (alive && res.data?.url) setUrl(res.data.url);
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
      task: () =>
        api<{ data: { url: string | null } }>(`/api/insights?kind=image&${q}${refresh}`),
      onSuccess: (res) => {
        if (res.data.url) setUrl(res.data.url);
        else setError('未配置文生图模型。在 .env.local 设置 AI_MODEL_IMAGE 后即可生成。');
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
      /* onError 已处理 */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={panelRef} className="space-y-3 pt-4">
      <p className="text-xs font-medium leading-relaxed text-muted">
        先选画面风格再生成；开始后自动转入右上角红点袋，完成后会弹出结果。
      </p>

      <ImageStylePicker value={style} onChange={setStyle} compact disabled={displayBusy} />

      {probing && !url && !displayBusy && (
        <p className="py-6 text-center text-sm text-muted">查看是否已有配图…</p>
      )}

      {displayBusy && (
        <p className="rounded-xl border border-dashed border-brand-200 bg-brand-50/60 px-4 py-3 text-center text-xs text-brand-800">
          已在后台生成，请看右上角红点袋
        </p>
      )}

      {!displayBusy && error && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>
      )}

      {!displayBusy && url && (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${label} 配图`}
            width={1024}
            height={1024}
            decoding="async"
            className="aspect-square w-full rounded-2xl border border-line bg-line/30 object-cover"
          />
          <figcaption className="mt-2 text-center text-xs text-muted">
            AI 依这一节经文生成的画面，非历史考据插图 · 长按图片可保存
          </figcaption>
        </figure>
      )}

      {!displayBusy && !probing && !url && (
        <button type="button" className="btn-primary w-full py-3" onClick={() => void generate()}>
          生成本节配图
        </button>
      )}

      {!displayBusy && url && (
        <button
          type="button"
          className="btn-ghost w-full py-2 text-sm"
          onClick={() => void generate(true)}
        >
          用当前风格再生成
        </button>
      )}
    </div>
  );
}
