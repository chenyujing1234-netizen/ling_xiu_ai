'use client';

import { useState } from 'react';
import { api } from '@/lib/client';

/** 设置项：灵修页经文下方是否直接展示马唐纳注释（默认显示） */
export default function VerseCommentaryToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle(next: boolean) {
    if (next === on || busy) return;
    setOn(next);
    setError('');
    setBusy(true);
    try {
      await api('/api/settings', { json: { showVerseCommentary: next } });
    } catch (err) {
      setOn(!next);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card px-4 py-4">
      <p className="label mb-1">经文注释展示</p>
      <p className="mb-3 text-xs font-medium text-muted">
        灵修页每节经文下方直接展示《马唐纳注释》原文（本地文本，非 AI 生成）
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => toggle(true)}
          className={`flex-1 rounded-xl border px-3 py-3 text-[15px] font-bold transition active:scale-[0.99] ${
            on ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300' : 'border-line bg-card text-ink'
          }`}
        >
          显示
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => toggle(false)}
          className={`flex-1 rounded-xl border px-3 py-3 text-[15px] font-bold transition active:scale-[0.99] ${
            !on ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300' : 'border-line bg-card text-ink'
          }`}
        >
          不显示
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-accent">{error}</p>}
    </section>
  );
}
