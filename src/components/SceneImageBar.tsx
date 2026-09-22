'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import Waiting from './Waiting';
import { SheetCloseButton } from '@/components/Ui';

/**
 * 选段配图：为他自己圈的这几节生成一张画面。
 *
 * 「意境配图」原来只能按整章生成，可读经时打动人的往往就是那么一两节。
 * 圈定之后按范围生成，服务端也按范围缓存 —— 同一段第二次圈中就直接出图，不再等。
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
  const [url, setUrl] = useState<string | null>(null);
  const [probing, setProbing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const q = `book=${book}&chapter=${chapter}&from=${from}&to=${to}`;
  const count = to - from + 1;

  // 换了选段就重新探一次缓存：圈过的段落不该让人再等一次生成
  useEffect(() => {
    let alive = true;
    setUrl(null);
    setError('');
    setProbing(true);
    api<{ data: { url: string | null } | null }>(`/api/insights?kind=image&${q}&cacheOnly=1`)
      .then((res) => {
        if (alive && res.data?.url) setUrl(res.data.url);
      })
      .catch(() => {
        /* 探不到就当没生成过，照常显示生成按钮 */
      })
      .finally(() => {
        if (alive) setProbing(false);
      });
    return () => {
      alive = false;
    };
  }, [q]);

  async function generate() {
    setBusy(true);
    setError('');
    setOpen(true);
    try {
      const res = await api<{ data: { url: string | null } }>(`/api/insights?kind=image&${q}`);
      if (res.data.url) setUrl(res.data.url);
      else setError('未配置文生图模型。在 .env.local 设置 AI_MODEL_IMAGE 后即可生成。');
    } catch (err) {
      setError((err as Error).message);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* 底栏浮在底部 Tab 之上：56px 的 Tab 再加安全区 */}
      <div
        className="fixed inset-x-0 z-30 border-t border-line bg-card/95 px-4 py-2.5 backdrop-blur"
        style={{ bottom: 'calc(56px + var(--safe-b))' }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{label}</p>
            <p className="text-[11px] text-muted">
              已选 {count} 节{url ? ' · 这段已生成过' : ''}
            </p>
          </div>
          <button onClick={onClear} className="btn-ghost px-3 py-1.5 text-xs">
            取消
          </button>
          {url ? (
            <button onClick={() => setOpen(true)} className="btn-primary px-3 py-1.5 text-xs">
              看图
            </button>
          ) : (
            <button onClick={generate} disabled={busy} className="btn-primary px-3 py-1.5 text-xs">
              {busy ? '生成中…' : '生成配图'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/35 fade-in" onClick={() => !busy && setOpen(false)} />
          <div className="sheet relative max-h-[88vh] overflow-y-auto no-bar px-5 pb-6">
            <SheetCloseButton onClick={() => setOpen(false)} disabled={busy} />
            <div className="sticky top-0 z-10 -mx-5 mb-3 bg-card px-5 pt-3 pr-12">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
              <div className="min-w-0 pb-2">
                <p className="truncate text-[15px] font-semibold">{label}</p>
                <p className="text-[11px] text-muted">共 {count} 节</p>
              </div>
            </div>

            {busy && <Waiting text="正在为这几节作画…" expect="通常 20-60 秒，生成后会存下来" />}

            {!busy && error && (
              <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>
            )}

            {!busy && !error && url && (
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

            {!busy && !probing && !url && !error && (
              <button onClick={generate} className="btn-primary w-full py-3">
                生成配图
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
