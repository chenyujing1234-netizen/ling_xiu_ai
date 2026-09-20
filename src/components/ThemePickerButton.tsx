'use client';

import { useState } from 'react';
import ThemePicker from './ThemePicker';

function IconPalette({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c-4.5 0-8 3.2-8 7.2 0 2.8 2.2 5 5 5h1.5a1.5 1.5 0 001.5-1.5c0-.8-.6-1.5-1.3-1.5H10a3 3 0 01-3-3c0-2.8 2.5-5.2 5.5-5.2 3.2 0 5.5 2.4 5.5 5.5 0 .6-.5 1.2-1.2 1.2H16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="6" r="1" fill="currentColor" />
      <circle cx="14" cy="6.5" r="1" fill="currentColor" />
      <circle cx="16" cy="9.5" r="1" fill="currentColor" />
    </svg>
  );
}

/** 首页右上角：点开底部面板选风格 */
export default function ThemePickerButton({ initial }: { initial: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="界面风格"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-brand-600 shadow-soft active:bg-brand-50"
      >
        <IconPalette />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-ink/35 fade-in" onClick={() => setOpen(false)} aria-hidden />
          <div className="sheet z-50 max-h-[85vh] overflow-y-auto no-bar px-5">
            <div className="pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
              <div className="mb-4 flex items-center justify-between gap-2">
                <p className="text-[17px] font-bold text-ink">界面风格</p>
                <button type="button" className="btn-quiet px-2" onClick={() => setOpen(false)} aria-label="关闭">
                  ✕
                </button>
              </div>
            </div>
            <ThemePicker initial={initial} variant="plain" />
          </div>
        </>
      )}
    </>
  );
}
