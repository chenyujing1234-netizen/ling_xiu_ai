'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import Recorder from './Recorder';
import Handwriting from './Handwriting';

export type VerseTarget = {
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  cn: string;
  en: string;
};

type Tab = 'text' | 'audio' | 'hand' | 'context';

const TABS: { key: Tab; label: string }[] = [
  { key: 'text', label: '写下' },
  { key: 'audio', label: '录音' },
  { key: 'hand', label: '手写' },
  { key: 'context', label: '上下文' },
];

export default function NoteSheet({
  target,
  devotionId,
  onClose,
  onSaved,
}: {
  target: VerseTarget;
  devotionId?: number | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('text');
  const [text, setText] = useState('');
  const [godSpoke, setGodSpoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const ref = `${target.bookName} ${target.chapter}:${target.verse}`;

  // 打开面板时锁住背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function done(message: string) {
    setToast(message);
    onSaved?.();
    setTimeout(onClose, 700);
  }

  async function saveText() {
    if (!text.trim() && !godSpoke) {
      setError('写点什么再保存吧');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api('/api/notes', {
        json: {
          bookId: target.bookId,
          chapter: target.chapter,
          verse: target.verse,
          content: text.trim(),
          godSpoke,
          devotionId: devotionId ?? null,
        },
      });
      done('已记下');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMedia(kind: 'audio' | 'handwriting', blob: Blob, durationMs?: number) {
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', blob, kind === 'audio' ? 'note.webm' : 'note.png');
      form.append('kind', kind);
      form.append('bookId', String(target.bookId));
      form.append('chapter', String(target.chapter));
      form.append('verse', String(target.verse));
      if (durationMs) form.append('durationMs', String(Math.round(durationMs)));
      if (devotionId) form.append('devotionId', String(devotionId));

      const res = await api<{ transcribed?: boolean }>('/api/notes', {
        method: 'POST',
        body: form,
      });
      done(kind === 'audio' ? (res.transcribed ? '录音已保存并转成文字' : '录音已保存') : '手写已保存');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/35 fade-in" onClick={onClose} />
      <div className="sheet max-h-[88vh] overflow-y-auto no-bar">
        <div className="sticky top-0 z-10 bg-card px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="chip">{ref}</p>
              <p className="scripture mt-2 line-clamp-3 text-[15px] text-ink/85">{target.cn}</p>
            </div>
            <button onClick={onClose} className="btn-quiet shrink-0 px-2" aria-label="关闭">
              ✕
            </button>
          </div>

          <div className="mt-3 flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                  tab === t.key
                    ? 'border-brand-500 font-medium text-brand-500'
                    : 'border-transparent text-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-4">
          {toast && (
            <p className="mt-4 rounded-xl bg-brand-50 px-3.5 py-2.5 text-center text-sm text-brand-700">
              {toast}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-accent/10 px-3.5 py-2.5 text-sm text-accent">{error}</p>
          )}

          {tab === 'text' && (
            <div className="space-y-3 pt-4">
              <textarea
                className="field min-h-[140px] resize-none"
                placeholder="神要通过这一节告诉你什么？&#10;哪怕说不清楚也写下来 —— 留心听，留心记。"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
              <label className="flex items-center gap-2.5 py-1 text-sm">
                <input
                  type="checkbox"
                  className="h-[18px] w-[18px] accent-brand-500"
                  checked={godSpoke}
                  onChange={(e) => setGodSpoke(e.target.checked)}
                />
                <span>这一节神对我说话</span>
              </label>
              <button className="btn-primary w-full py-3" onClick={saveText} disabled={busy}>
                {busy ? '保存中…' : '保存笔记'}
              </button>
            </div>
          )}

          {tab === 'audio' && (
            <Recorder busy={busy} onDone={(blob, ms) => saveMedia('audio', blob, ms)} />
          )}

          {tab === 'hand' && (
            <Handwriting busy={busy} onDone={(blob) => saveMedia('handwriting', blob)} />
          )}

          {tab === 'context' && <ContextPanel target={target} />}
        </div>
      </div>
    </>
  );
}

// ---------- 上下文透视（R-B4） ----------

type ContextData = {
  target: { cn: string; en: string };
  before: { chapter: number; verse: number; cn: string }[];
  after: { chapter: number; verse: number; cn: string }[];
};

type AiContext = {
  before_effect: string;
  after_effect: string;
  hinge: string;
  misread: string;
  cn_en: string;
};

function ContextPanel({ target }: { target: VerseTarget }) {
  const [data, setData] = useState<ContextData | null>(null);
  const [ai, setAi] = useState<AiContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ContextData>(
      `/api/bible/context?book=${target.bookId}&chapter=${target.chapter}&verse=${target.verse}`,
    )
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [target]);

  async function loadAi() {
    setAiBusy(true);
    setError('');
    try {
      const res = await api<{ data: AiContext }>(
        `/api/insights?kind=context&book=${target.bookId}&chapter=${target.chapter}&verse=${target.verse}`,
      );
      setAi(res.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  if (loading) return <p className="py-8 text-center text-sm text-muted">加载上下文…</p>;
  if (!data) return <p className="py-8 text-center text-sm text-accent">{error || '加载失败'}</p>;

  const line = (v: { chapter: number; verse: number; cn: string }) => (
    <p key={`${v.chapter}-${v.verse}`} className="scripture text-[14px] text-muted">
      <span className="mr-1 text-[11px] text-brand-300">
        {v.chapter}:{v.verse}
      </span>
      {v.cn}
    </p>
  );

  return (
    <div className="space-y-4 pt-4">
      <section>
        <p className="label mb-1.5">前 {data.before.length} 节</p>
        <div className="space-y-1">{data.before.map(line)}</div>
      </section>

      <section className="rounded-xl border-l-[3px] border-brand-500 bg-brand-50/60 px-3.5 py-3">
        <p className="label mb-1.5">本节</p>
        <p className="scripture text-[15px] text-ink">{data.target.cn}</p>
        {data.target.en && (
          <p className="mt-2 text-[13px] italic leading-relaxed text-muted">{data.target.en}</p>
        )}
      </section>

      <section>
        <p className="label mb-1.5">后 {data.after.length} 节</p>
        <div className="space-y-1">{data.after.map(line)}</div>
      </section>

      {error && <p className="rounded-xl bg-accent/10 px-3.5 py-2.5 text-sm text-accent">{error}</p>}

      {!ai ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-4 text-center">
          <p className="mb-3 text-sm leading-relaxed text-muted">
            先自己看一遍上下文。
            <br />
            想过之后，再看前后文如何影响这一节。
          </p>
          <button className="btn-ghost" onClick={loadAi} disabled={aiBusy}>
            {aiBusy ? '分析中…' : '我想过了，看分析'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(
            [
              ['前文如何铺垫', ai.before_effect],
              ['后文如何回应', ai.after_effect],
              ['本节的功能', ai.hinge],
              ['常见的断章取义', ai.misread],
              ['中英对照差异', ai.cn_en],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="card px-4 py-3">
                <p className="label mb-1">{label}</p>
                <p className="text-[14px] leading-relaxed text-ink/90">{value}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
