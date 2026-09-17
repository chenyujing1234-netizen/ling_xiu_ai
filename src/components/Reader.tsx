'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import NoteSheet, { type VerseTarget } from './NoteSheet';

type Verse = { book_id: number; chapter: number; verse: number; cn: string; en: string };
type Note = {
  id: number;
  verse: number;
  kind: string;
  content: string;
  media_path: string | null;
  god_spoke: number;
};
type Resource = {
  id: number;
  title: string;
  speaker: string | null;
  source: string | null;
  url: string;
  verse_start: number;
  verse_end: number;
  start_sec: number | null;
  note: string | null;
};
type BookBrief = { id: number; name: string; chapters: number; testament: string };
type ChapterData = {
  book: { id: number; name_cn: string; name_en: string; chapters: number; genre: string };
  chapter: number;
  verses: Verse[];
  notes: Note[];
  resources: Resource[];
  books: BookBrief[];
};

const LONG_PRESS_MS = 450;

export default function Reader({
  initialBook,
  initialChapter,
  devotionId,
}: {
  initialBook: number;
  initialChapter: number;
  devotionId?: number | null;
}) {
  const [book, setBook] = useState(initialBook);
  const [chapter, setChapter] = useState(initialChapter);
  const [data, setData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bilingual, setBilingual] = useState(false);
  const [target, setTarget] = useState<VerseTarget | null>(null);
  const [pressing, setPressing] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api<ChapterData>(`/api/bible/chapter?book=${book}&chapter=${chapter}`);
      setData(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [book, chapter]);

  useEffect(() => {
    load();
  }, [load]);

  // 换章后回到顶部，并把位置写进地址栏，便于分享与回退
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const url = new URL(window.location.href);
    url.searchParams.set('book', String(book));
    url.searchParams.set('chapter', String(chapter));
    window.history.replaceState(null, '', url.toString());
  }, [book, chapter]);

  // ---------- 长按检测（R-B3 / R-G4） ----------
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  function pressStart(v: Verse, e: React.PointerEvent) {
    if (!data) return;
    if (e.pointerType !== 'touch') {
      // 鼠标/触控板：接管指针，这样手稍微滑出这一行也不会被 pointerleave 打断；
      // 同时阻止按住文本被当成拖拽或选择的起点
      e.currentTarget.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    startPoint.current = { x: e.clientX, y: e.clientY };
    setPressing(v.verse);
    timer.current = setTimeout(() => {
      navigator.vibrate?.(12); // 有触感反馈，用户才知道"长按成功了"
      setTarget({
        bookId: data.book.id,
        bookName: data.book.name_cn,
        chapter: data.chapter,
        verse: v.verse,
        cn: v.cn,
        en: v.en,
      });
      setPressing(null);
    }, LONG_PRESS_MS);
  }

  function pressMove(e: React.PointerEvent) {
    if (!startPoint.current) return;
    // 触摸要灵敏地让位给页面滚动，容差就得小；但鼠标和触控笔没有滚动手势之争，
    // 只需容忍手抖 —— 之前统一按 8px 判定，用鼠标或触控板按住时轻轻一滑长按就没了。
    const slop = e.pointerType === 'touch' ? 10 : 30;
    const dx = Math.abs(e.clientX - startPoint.current.x);
    const dy = Math.abs(e.clientY - startPoint.current.y);
    if (dx > slop || dy > slop) pressCancel();
  }

  function pressCancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    startPoint.current = null;
    setPressing(null);
  }

  useEffect(() => () => pressCancel(), []);

  const notesByVerse = new Map<number, Note[]>();
  for (const n of data?.notes ?? []) {
    notesByVerse.set(n.verse, [...(notesByVerse.get(n.verse) ?? []), n]);
  }

  const currentBook = data?.books.find((b) => b.id === book);
  const canPrev = chapter > 1 || book > 1;
  const canNext = data ? chapter < data.book.chapters || book < 66 : false;

  function go(delta: 1 | -1) {
    if (!data) return;
    let b = book;
    let c = chapter + delta;
    if (c < 1) {
      b = Math.max(1, book - 1);
      const prev = data.books.find((x) => x.id === b);
      c = prev?.chapters ?? 1;
    } else if (c > data.book.chapters) {
      b = Math.min(66, book + 1);
      c = 1;
    }
    setBook(b);
    setChapter(c);
  }

  return (
    <div>
      {/* 顶栏 */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setPicker(true)} className="flex items-center gap-1.5 text-left">
            <span className="text-[17px] font-semibold">
              {data?.book.name_cn ?? '读经'} {data?.chapter ?? ''}
            </span>
            <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" />
            </svg>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setBilingual((v) => !v)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                bilingual ? 'bg-brand-500 text-white' : 'border border-line text-muted'
              }`}
            >
              中英
            </button>
            {data && (
              <Link
                href={`/devotion/start?book=${book}&chapter=${chapter}`}
                className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-white"
              >
                灵修
              </Link>
            )}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted">长按任意一节 → 口述 / 写下笔记 / 看上下文</p>
      </header>

      {loading && <p className="py-16 text-center text-sm text-muted">加载经文…</p>}
      {error && <p className="mx-4 mt-6 rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>}

      {/* 经文正文 */}
      {data && !loading && (
        <div className="px-4 py-4">
          <div className="space-y-1">
            {data.verses.map((v) => {
              const notes = notesByVerse.get(v.verse) ?? [];
              const spoke = notes.some((n) => n.god_spoke);
              return (
                <div
                  key={v.verse}
                  onPointerDown={(e) => pressStart(v, e)}
                  onPointerMove={pressMove}
                  onPointerUp={pressCancel}
                  onPointerCancel={pressCancel}
                  onPointerLeave={pressCancel}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`no-select rounded-lg px-2 py-1.5 transition ${
                    pressing === v.verse ? 'bg-brand-100' : ''
                  } ${spoke ? 'border-l-[3px] border-accent bg-accent/[0.04]' : ''}`}
                >
                  <p className="scripture">
                    <sup className="mr-1 select-none align-super text-[11px] font-medium text-brand-300">
                      {v.verse}
                    </sup>
                    {v.cn}
                    {notes.length > 0 && (
                      <span className="ml-1.5 inline-flex align-middle text-[11px] text-accent">
                        {notes.some((n) => n.kind === 'audio') && '🎙'}
                        {notes.some((n) => n.kind === 'text') && '·'}
                      </span>
                    )}
                  </p>
                  {bilingual && v.en && (
                    <p className="mt-1 pl-4 text-[13px] leading-relaxed text-muted">{v.en}</p>
                  )}
                  {notes
                    .filter((n) => n.content || n.media_path)
                    .map((n) => (
                      <div key={n.id} className="mt-1.5 ml-4 rounded-lg bg-brand-50/70 px-3 py-2">
                        {n.content && <p className="text-[13px] leading-relaxed text-brand-700">{n.content}</p>}
                        {n.kind === 'audio' && n.media_path && (
                          <audio src={`/api/media/${n.media_path}`} controls className="mt-1 h-8 w-full" />
                        )}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>

          {/* 讲道资源（R-F2） */}
          {data.resources.length > 0 && (
            <section className="mt-8">
              <h2 className="label mb-2">这段经文的讲道与解释</h2>
              <div className="space-y-2">
                {data.resources.map((r) => (
                  <a
                    key={r.id}
                    href={r.start_sec ? withTime(r.url, r.start_sec) : r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="card block px-4 py-3 active:bg-brand-50"
                  >
                    <p className="text-[15px] font-medium">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[r.speaker, r.source, verseRange(r)].filter(Boolean).join(' · ')}
                      {r.start_sec ? ` · 从 ${fmtTime(r.start_sec)} 开始` : ''}
                    </p>
                    {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* 翻章 */}
          <div className="mt-8 flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => go(-1)} disabled={!canPrev}>
              上一章
            </button>
            <button className="btn-ghost flex-1" onClick={() => go(1)} disabled={!canNext}>
              下一章
            </button>
          </div>

          <Link
            href={`/devotion/start?book=${book}&chapter=${chapter}`}
            className="btn-primary mt-3 w-full py-3"
          >
            就这一章开始灵修
          </Link>
          <p className="mt-2 text-center text-xs text-muted">
            翻完页不算读过 —— 有观察、有提问、有回应才算
          </p>
        </div>
      )}

      {/* 经卷选择 */}
      {picker && data && (
        <BookPicker
          books={data.books}
          current={{ book, chapter }}
          onPick={(b, c) => {
            setBook(b);
            setChapter(c);
            setPicker(false);
          }}
          onClose={() => setPicker(false)}
        />
      )}

      {target && (
        <NoteSheet
          target={target}
          devotionId={devotionId}
          onClose={() => setTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function verseRange(r: Resource) {
  if (!r.verse_start) return '';
  return r.verse_end && r.verse_end !== r.verse_start
    ? `${r.verse_start}-${r.verse_end}节`
    : `${r.verse_start}节`;
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 给视频链接补上时间参数，实现"截取该节讲解片段"的跳转（R-F3） */
function withTime(url: string, sec: number) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('bilibili')) u.searchParams.set('t', String(sec));
    else if (u.hostname.includes('youtube') || u.hostname.includes('youtu.be'))
      u.searchParams.set('t', `${sec}s`);
    else u.hash = `t=${sec}`;
    return u.toString();
  } catch {
    return url;
  }
}

// ---------- 经卷章节选择器 ----------

function BookPicker({
  books,
  current,
  onPick,
  onClose,
}: {
  books: BookBrief[];
  current: { book: number; chapter: number };
  onPick: (book: number, chapter: number) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState(current.book);
  const book = books.find((b) => b.id === sel);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/35 fade-in" onClick={onClose} />
      <div className="sheet flex max-h-[80vh] flex-col">
        <div className="px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <p className="mb-2 text-[15px] font-semibold">选择经卷</p>
        </div>
        <div className="flex min-h-0 flex-1">
          <ul className="w-[40%] overflow-y-auto border-r border-line no-bar">
            {(['OT', 'NT'] as const).map((t) => (
              <li key={t}>
                <p className="sticky top-0 bg-brand-50 px-4 py-1.5 text-[11px] font-medium text-brand-700">
                  {t === 'OT' ? '旧约' : '新约'}
                </p>
                {books
                  .filter((b) => b.testament === t)
                  .map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSel(b.id)}
                      className={`block w-full px-4 py-2.5 text-left text-sm ${
                        sel === b.id ? 'bg-brand-100 font-medium text-brand-700' : 'text-ink'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
          <div className="flex-1 overflow-y-auto p-3 no-bar">
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: book?.chapters ?? 0 }, (_, i) => i + 1).map((c) => (
                <button
                  key={c}
                  onClick={() => onPick(sel, c)}
                  className={`aspect-square rounded-lg border text-sm ${
                    sel === current.book && c === current.chapter
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-line text-ink'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
