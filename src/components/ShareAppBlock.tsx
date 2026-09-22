'use client';

import { useEffect, useState } from 'react';
import { SHARE_APP_VARIANTS, buildShareAppText } from '@/lib/share-app';
import { IconTile } from '@/components/Ui';
import SheetModal from '@/components/SheetModal';

const LAST_VARIANT_KEY = 'share_app_variant';

function IconShare({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V4m0 0l3.5 3.5M12 4 8.5 7.5M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function ShareAppBlock({ appUrl }: { appUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [failedText, setFailedText] = useState('');

  useEffect(() => {
    try {
      const id = localStorage.getItem(LAST_VARIANT_KEY);
      if (id && SHARE_APP_VARIANTS.some((v) => v.id === id)) setLastId(id);
    } catch {
      /* 隐私模式等 */
    }
  }, []);

  const lastLabel = SHARE_APP_VARIANTS.find((v) => v.id === lastId)?.label ?? null;

  async function shareVariant(id: string) {
    const variant = SHARE_APP_VARIANTS.find((v) => v.id === id);
    if (!variant || busyId) return;
    const text = buildShareAppText(appUrl, id);
    setBusyId(id);
    setFailedText('');
    try {
      const ok = await writeClipboard(text);
      if (ok) {
        setCopiedId(id);
        setLastId(id);
        setFeedback(`已复制「${variant.label}」文案，可打开微信粘贴发给朋友`);
        try {
          localStorage.setItem(LAST_VARIANT_KEY, id);
        } catch {
          /* ignore */
        }
      } else {
        setCopiedId(null);
        setFailedText(text);
        setFeedback('没能自动复制。请长按下面全文，手动复制后再发给朋友');
      }
    } finally {
      setBusyId(null);
    }
  }

  function close() {
    setOpen(false);
    setFailedText('');
  }

  return (
    <li>
      <button
        type="button"
        className="card flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-brand-50"
        onClick={() => {
          setFeedback('');
          setFailedText('');
          setOpen(true);
        }}
      >
        <IconTile tone="brand">
          <IconShare />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">分享给朋友</p>
          <p className="mt-0.5 text-xs font-medium text-muted">
            {copiedId && lastLabel
              ? `已复制「${lastLabel}」，可粘贴到微信`
              : lastLabel
                ? `点开选文案 · 上次用「${lastLabel}」`
                : '点开选一段文案，复制后发给弟兄姊妹'}
          </p>
        </div>
      </button>

      {open && (
        <SheetModal onClose={close} zBackdrop={85} zSheet={95} className="max-h-[82vh]">
          <div className="px-5 pb-6">
            <div className="pt-3 pr-10">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
              <p className="text-[15px] font-semibold">选一段分享文案</p>
              <p className="mt-0.5 text-xs text-muted">点选后会复制到剪贴板，再去微信粘贴即可</p>
            </div>

            {feedback && (
              <p
                className={`mt-3 rounded-xl px-3.5 py-3 text-center text-sm font-semibold ${
                  failedText ? 'bg-accent/10 text-accent' : 'bg-brand-500 text-white'
                }`}
                role="status"
              >
                {feedback}
              </p>
            )}

            {failedText && (
              <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-paper/80 p-3 text-[13px] leading-relaxed text-ink/90 no-bar">
                {failedText}
              </pre>
            )}

            <ul className="mt-4 space-y-2.5">
              {SHARE_APP_VARIANTS.map((v) => {
                const preview = v.build(appUrl.replace(/\/$/, '')).split('\n').slice(0, 3).join('\n');
                const justCopied = copiedId === v.id;
                const lastUsed = lastId === v.id;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      disabled={busyId != null}
                      onClick={() => void shareVariant(v.id)}
                      className={`w-full rounded-xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${
                        justCopied
                          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300'
                          : lastUsed
                            ? 'border-brand-300 bg-card'
                            : 'border-line bg-card'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-bold">{v.label}</p>
                        {justCopied && (
                          <span className="shrink-0 rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                            已复制
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-muted">{v.hint}</p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[12px] leading-relaxed text-ink/75">
                        {preview}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </SheetModal>
      )}
    </li>
  );
}
