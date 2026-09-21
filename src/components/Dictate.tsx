'use client';

import { useState } from 'react';
import Recorder from './Recorder';
import { transcribe } from '@/lib/dictate';

/**
 * 输入框旁边的"口述"。说完把文字填回输入框，由他自己接着改、自己提交。
 *
 * 灵修七步里每一处要写字的地方都该能说 —— 心里被触动的时候，
 * 说出来比在手机上打字顺畅得多。
 *
 * 做成弹层而不是就地展开：这几处的排版各不相同（有单行框、有多行框、
 * 有嵌在卡片里的），弹层不动原有布局，六处的手感也一致。
 */
export default function Dictate({
  onText,
  disabled,
  hint = '说完自动填进输入框，可以接着改',
}: {
  onText: (text: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handle(blob: Blob) {
    setError('');
    setBusy(true);
    try {
      const said = await transcribe(blob);
      if (!said) {
        setError('没听清，再说一次');
        return;
      }
      onText(said);
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('');
          setOpen(true);
        }}
        disabled={disabled}
        className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" strokeLinecap="round" />
        </svg>
        口述
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/35 fade-in" onClick={() => !busy && setOpen(false)} />
          <div className="sheet px-5 pb-6">
            <div className="pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold">口述</p>
                <button
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="btn-quiet px-2"
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-xl bg-accent/10 px-3.5 py-2.5 text-sm text-accent">{error}</p>
            )}

            <Recorder autoStart busy={busy} onDone={handle} note={hint} />
          </div>
        </>
      )}
    </>
  );
}
