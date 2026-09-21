'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import {
  applyFontScaleClient,
  FONT_SCALES,
  normalizeFontScale,
  type FontScaleId,
} from '@/lib/font-scale';

export default function FontScalePicker({ initial }: { initial: string }) {
  const [scale, setScale] = useState<FontScaleId>(() => normalizeFontScale(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(id: FontScaleId) {
    if (id === scale || busy) return;
    setScale(id);
    setError('');
    applyFontScaleClient(id);
    setBusy(true);
    try {
      await api('/api/settings', { json: { fontScale: id } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card px-4 py-4">
      <p className="label mb-1">字体大小</p>
      <p className="mb-3 text-xs font-medium text-muted">点选即切换，读经、灵修、笔记全站生效</p>
      <ul className="space-y-2">
        {FONT_SCALES.map((s) => {
          const active = scale === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => pick(s.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                  active ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300' : 'border-line bg-card'
                }`}
              >
                <span
                  className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg border border-line bg-paper font-bold text-brand-600"
                  style={{ fontSize: `${12 + s.percent / 25}px` }}
                  aria-hidden
                >
                  字
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-ink">
                    {s.name}
                    <span className="ml-1.5 text-xs font-semibold text-muted">约 {s.percent}%</span>
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-muted">{s.desc}</span>
                </span>
                {active && <span className="shrink-0 text-xs font-bold text-brand-600">当前</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="scripture mt-4 rounded-xl border border-line/80 bg-paper px-3 py-2.5 text-brand-700/95">
        耶和华是我的牧者，我必不至缺乏。
      </p>
      {error && <p className="mt-2 text-xs text-accent">{error}</p>}
    </section>
  );
}
