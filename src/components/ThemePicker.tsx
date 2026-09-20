'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { applyThemeClient, THEMES, normalizeTheme, type ThemeId } from '@/lib/themes';

export default function ThemePicker({
  initial,
  variant = 'card',
}: {
  initial: string;
  /** plain：嵌入弹层；card：设置页卡片 */
  variant?: 'card' | 'plain';
}) {
  const [theme, setTheme] = useState<ThemeId>(() => normalizeTheme(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(id: ThemeId) {
    if (id === theme || busy) return;
    setTheme(id);
    setError('');
    applyThemeClient(id);
    setBusy(true);
    try {
      await api('/api/settings', { json: { theme: id } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const list = (
    <>
      {variant === 'card' && (
        <>
          <p className="label mb-1">界面风格</p>
          <p className="mb-3 text-xs font-medium text-muted">点选即切换，全站生效</p>
        </>
      )}
      {variant === 'plain' && (
        <p className="mb-3 text-xs font-medium text-muted">点选即切换，全站生效</p>
      )}
      <ul className="space-y-2">
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => pick(t.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                  active ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300' : 'border-line bg-card'
                }`}
              >
                <span className="flex shrink-0 gap-0.5 overflow-hidden rounded-lg border border-line">
                  {t.swatch.map((c) => (
                    <span key={c} className="h-9 w-4" style={{ backgroundColor: c }} aria-hidden />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-ink">{t.name}</span>
                  <span className="mt-0.5 block text-xs font-medium text-muted">{t.desc}</span>
                </span>
                {active && (
                  <span className="shrink-0 text-xs font-bold text-brand-600">当前</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-accent">{error}</p>}
    </>
  );

  if (variant === 'plain') {
    return <div className="pb-4">{list}</div>;
  }
  return <section className="card px-4 py-4">{list}</section>;
}
