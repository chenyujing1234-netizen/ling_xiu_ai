'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { scheduleAutoBackgroundDismiss } from '@/lib/auto-background';
import { SheetCloseButton } from '@/components/Ui';
import ImageStylePicker, { usePreferredImageStyle } from './ImageStylePicker';
import { useBackgroundJobs } from './BackgroundJobsProvider';
import { useBindOverlayHistory } from '@/lib/overlay-history';

/**
 * 选段配图：为他自己圈的这几节生成一张画面。
 */
export default function SceneImageBar({
  book,
  chapter,
  from,
  to,
  label,
  onClear,
}: {
  book: number;
  chapter: number;
  from: number;
  to: number;
  label: string;
  onClear: () => void;
}) {
  const { runJob } = useBackgroundJobs();
  const [url, setUrl] = useState<string | null>(null);
  const [probing, setProbing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [style, setStyle] = usePreferredImageStyle();
  const sheetRef = useRef<HTMLDivElement>(null);

  const q = `book=${book}&chapter=${chapter}&from=${from}&to=${to}&style=${encodeURIComponent(style)}`;
  const count = to - from + 1;

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

  async function generate(regenerate = false) {
    setError('');
    setBusy(true);

    const refresh = regenerate ? '&refresh=1' : '';
    const rect = sheetRef.current?.getBoundingClientRect();
    const throwFrom = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + 48 }
      : { x: window.innerWidth / 2, y: window.innerHeight * 0.78 };

    const { promise } = runJob({
      label: `配图 ${label}`,
      throwFrom,
      task: () =>
        api<{ data: { url: string | null } }>(`/api/insights?kind=image&${q}${refresh}`),
      onSuccess: (res) => {
        if (res.data.url) setUrl(res.data.url);
        else setError('未配置文生图模型。在 .env.local 设置 AI_MODEL_IMAGE 后即可生成。');
      },
      onError: (err) => {
        setError(err.message);
      },
      present: () => {
        setOpen(true);
        sheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
    });

    scheduleAutoBackgroundDismiss(() => setOpen(false));

    try {
      await promise;
    } catch {
      /* handled */
    } finally {
      setBusy(false);
    }
  }

  useBindOverlayHistory(open, () => setOpen(false));

  return (
    <>
      <div
        className="fixed inset-x-0 z-30 border-t border-line bg-card/95 px-4 py-2.5 backdrop-blur"
        style={{ bottom: 'calc(56px + var(--safe-b))' }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{label}</p>
            <p className="text-[11px] text-muted">
              已选 {count} 节
              {url ? ' · 这段已生成过' : ''}
              {busy ? ' · 后台生成中' : ''}
            </p>
          </div>
          <button onClick={onClear} className="btn-ghost px-3 py-1.5 text-xs" disabled={busy}>
            取消
          </button>
          {url ? (
            <button onClick={() => setOpen(true)} className="btn-primary px-3 py-1.5 text-xs">
              看图
            </button>
          ) : (
            <button onClick={() => void generate()} disabled={busy} className="btn-primary px-3 py-1.5 text-xs">
              {busy ? '生成中…' : '生成配图'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/35 fade-in" onClick={() => setOpen(false)} />
          <div ref={sheetRef} className="sheet relative z-50 max-h-[88vh] overflow-y-auto no-bar px-5 pb-6">
            <SheetCloseButton onClick={() => setOpen(false)} />
            <div className="sticky top-0 z-10 -mx-5 mb-3 bg-card px-5 pt-3 pr-12">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
              <div className="min-w-0 pb-2">
                <p className="truncate text-[15px] font-semibold">{label}</p>
                <p className="text-[11px] text-muted">共 {count} 节</p>
              </div>
            </div>

            {busy && (
              <p className="mb-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 px-4 py-3 text-center text-xs text-brand-800">
                已在后台生成，请看右上角红点袋
              </p>
            )}

            {error && (
              <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>
            )}

            <div className="mb-4">
              <ImageStylePicker value={style} onChange={setStyle} compact disabled={busy} />
            </div>

            {!error && url && (
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${label} 意境配图`}
                  width={1024}
                  height={1024}
                  decoding="async"
                  className="aspect-square w-full rounded-2xl border border-line bg-line/30 object-cover"
                />
                <figcaption className="mt-2 text-center text-xs text-muted">
                  AI 依这几节经文生成的画面，非历史考据插图 —— 长按图片可保存
                </figcaption>
              </figure>
            )}

            {!busy && url && (
              <button onClick={() => void generate(true)} className="btn-ghost mt-3 w-full py-2 text-sm">
                用当前风格再生成
              </button>
            )}

            {!busy && !probing && !url && !error && (
              <button onClick={() => void generate()} className="btn-primary w-full py-3">
                生成配图
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
