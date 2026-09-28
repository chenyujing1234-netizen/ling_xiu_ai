'use client';

import { useState } from 'react';
import { IconPalette, SheetCloseButton } from '@/components/Ui';
import ThemePicker from './ThemePicker';

/** 首页右上角：点开底部面板选风格 */
export default function ThemePickerButton({ initial }: { initial: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="界面风格"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-card shadow-soft active:bg-brand-50"
      >
        <IconPalette size={22} colorful />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-ink/35 fade-in" onClick={() => setOpen(false)} aria-hidden />
          <div className="sheet relative z-50 max-h-[85vh] overflow-y-auto no-bar px-5">
            <SheetCloseButton onClick={() => setOpen(false)} />
            <div className="pt-3 pr-10">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
              <p className="mb-4 text-[17px] font-bold text-ink">界面风格</p>
            </div>
            <ThemePicker initial={initial} variant="plain" />
          </div>
        </>
      )}
    </>
  );
}
