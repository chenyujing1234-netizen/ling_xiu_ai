'use client';

import { useEffect, useState } from 'react';
import {
  IMAGE_STYLES,
  readStoredImageStyle,
  writeStoredImageStyle,
  type ImageStyleId,
} from '@/lib/image-styles';

type Props = {
  value: ImageStyleId;
  onChange: (id: ImageStyleId) => void;
  /** 读经底栏等窄空间：横向滚动芯片 */
  compact?: boolean;
  disabled?: boolean;
};

export default function ImageStylePicker({ value, onChange, compact, disabled }: Props) {
  function pick(id: ImageStyleId) {
    if (disabled || id === value) return;
    writeStoredImageStyle(id);
    onChange(id);
  }

  if (compact) {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted">画面风格</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 no-bar">
          {IMAGE_STYLES.map((s) => {
            const active = value === s.id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => pick(s.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
                    : 'border-line bg-card text-ink'
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted">选择你喜欢的画面风格，生成时会写入提示词</p>
      <ul className="space-y-2">
        {IMAGE_STYLES.map((s) => {
          const active = value === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => pick(s.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                  active ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300' : 'border-line bg-card'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink">{s.name}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-muted">{s.desc}</span>
                </span>
                {active && <span className="shrink-0 text-xs font-bold text-brand-600">当前</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 挂载后从 localStorage 读取默认风格 */
export function usePreferredImageStyle(): [ImageStyleId, (id: ImageStyleId) => void] {
  const [style, setStyle] = useState<ImageStyleId>('classic');
  useEffect(() => {
    setStyle(readStoredImageStyle());
  }, []);
  return [style, setStyle];
}
