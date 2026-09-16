'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

type BookBrief = { id: number; name: string; chapters: number };

export default function SettingsForm({
  books,
  initial,
}: {
  books: BookBrief[];
  initial: { dailyChapters: number; cursorBook: number; cursorChapter: number };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const book = books.find((b) => b.id === form.cursorBook);

  async function save() {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await api('/api/settings', { json: form });
      setMsg('已保存');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card px-4 py-4">
        <p className="label mb-2.5">每天读几章</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => setForm({ ...form, dailyChapters: n })}
              className={`h-11 flex-1 rounded-xl border text-sm transition ${
                form.dailyChapters === n
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-line text-ink'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">按每天 4 章的节奏，一年可以读完全本圣经。</p>
      </section>

      <section className="card px-4 py-4">
        <p className="label mb-2.5">当前读经进度</p>
        <div className="flex gap-2">
          <select
            className="field flex-1"
            value={form.cursorBook}
            onChange={(e) => setForm({ ...form, cursorBook: Number(e.target.value), cursorChapter: 1 })}
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="field w-28"
            value={form.cursorChapter}
            onChange={(e) => setForm({ ...form, cursorChapter: Number(e.target.value) })}
          >
            {Array.from({ length: book?.chapters ?? 1 }, (_, i) => i + 1).map((c) => (
              <option key={c} value={c}>
                {c} 章
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-xs text-muted">今日读经会从这里开始，往后连续排 {form.dailyChapters} 章。</p>
      </section>

      {msg && <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700">{msg}</p>}
      {error && <p className="rounded-xl bg-accent/10 px-3.5 py-2.5 text-sm text-accent">{error}</p>}

      <button className="btn-primary w-full py-3" onClick={save} disabled={busy}>
        {busy ? '保存中…' : '保存设置'}
      </button>
    </div>
  );
}
