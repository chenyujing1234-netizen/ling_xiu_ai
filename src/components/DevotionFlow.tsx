'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, hardNavigate } from '@/lib/client';
import BookPicker, { type BookBrief } from './BookPicker';
import { useAutoSaveDevotionText } from './useAutoSaveDevotionText';
import {
  IconLongPress,
  IconScripture,
  NoteReviewedBadge,
  VerseLongPressHint,
} from '@/components/Ui';
import { joinDictation } from '@/lib/dictate';
import Dictate from './Dictate';
import NoteSheet, { type NoteEdit, type VerseTarget } from './NoteSheet';
import PageBackButton from './PageBackButton';
import SheetModal from './SheetModal';
import ChapterNotesReviewBlock from './ChapterNotesReviewBlock';
import NoteReviewBlock from './NoteReviewBlock';
import Waiting from './Waiting';
import RagSourcesFootnote from './RagSourcesFootnote';
import type { RagSource } from '@/lib/rag-sources';
const LONG_PRESS_MS = 450;

const FEEDBACK_STAGE_TITLE: Record<string, string> = {
  observe: '观察',
  inquire: '自己提问',
  reflect: '默想作答',
  guided: '引导',
  life: '生命实事',
};

// ---------- 类型 ----------

type Stage = 'observe' | 'inquire' | 'reflect' | 'guided' | 'life' | 'prayer' | 'done';

type Devotion = {
  id: number;
  book_id: number;
  chapter: number;
  verse_start: number;
  verse_end: number;
  stage: Stage;
  score: number;
  unlocked: number;
  completed_at: string | null;
};
type Input = { id: number; kind: string; content: string; created_at: string; prompt_id?: number | null };
type Prompt = { id: number; layer: string; bridge: string | null; question: string };
type Score = { dimension: string; score: number; reason: string };
type CoachMsg = { role: string; content: string; ragSources?: RagSource[] };
type Verse = { verse: number; cn: string; en: string };
type Note = {
  id: number;
  verse: number;
  kind: string;
  content: string;
  media_path: string | null;
  god_spoke: number;
  readerReviewed?: boolean;
};

type FeedbackStageKey = 'observe' | 'inquire' | 'reflect' | 'guided' | 'life';

type Detail = {
  devotion: Devotion;
  unlockScore: number;
  passage: { label: string; genre: string; verses: Verse[] };
  inputs: Input[];
  prompts: Prompt[];
  scores: Score[];
  coach: CoachMsg[];
  notes: Note[];
  chapterNotesReviewed?: boolean;
  gate: { ok: boolean; reason?: string };
  stageFeedbacks?: Partial<Record<FeedbackStageKey, string>>;
  stageFeedbackRagSources?: Partial<Record<FeedbackStageKey, RagSource[]>>;
};

const STEPS: { key: Stage; label: string }[] = [
  { key: 'observe', label: '观察' },
  { key: 'inquire', label: '提问' },
  { key: 'reflect', label: '默想' },
  { key: 'guided', label: '引导' },
  { key: 'life', label: '实事' },
  { key: 'prayer', label: '祷告' },
];

const LAYER_LABEL: Record<string, string> = {
  fact: '事实层',
  flow: '脉络层',
  theology: '要义层',
  application: '处境层',
};

const DIM_LABEL: Record<string, string> = {
  observation: '观察准确',
  inquiry: '提问深度',
  thesis: '要义把握',
  personal: '个人化',
};

// ---------- 主组件 ----------

type AdvanceResult = {
  stage?: string;
  feedback?: string | null;
  feedbackRagSources?: RagSource[];
  feedbackFor?: string;
  feedbackSkipped?: boolean;
};

export default function DevotionFlow({ id }: { id: number }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stageFeedback, setStageFeedback] = useState<{
    from: string;
    text: string;
    ragSources?: RagSource[];
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [books, setBooks] = useState<BookBrief[]>([]);

  const load = useCallback(async () => {
    try {
      setD(await api<Detail>(`/api/devotion/${id}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<{ books: BookBrief[] }>('/api/bible/books');
        if (!cancelled) setBooks(res.books);
      } catch {
        /* 打开选择器时再拉一次 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const act = useCallback(
    async <T,>(payload: Record<string, unknown>): Promise<T | null> => {
      setBusy(true);
      setError('');
      try {
        const res = await api<T>(`/api/devotion/${id}/action`, { json: payload });
        await load();
        if (payload.action === 'advance') {
          const adv = res as AdvanceResult | null;
          if (adv?.feedback?.trim() && !adv.feedbackSkipped) {
            const from = adv.feedbackFor
              ? FEEDBACK_STAGE_TITLE[adv.feedbackFor] ?? adv.feedbackFor
              : '这一步';
            setStageFeedback({
              from,
              text: adv.feedback.trim(),
              ragSources: adv.feedbackRagSources,
            });
          }
        }
        return res;
      } catch (err) {
        setError((err as Error).message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [id, load],
  );

  /** 自动保存输入：不占用全局 busy，避免输入时整页锁住 */
  const sync = useCallback(
    async <T,>(payload: Record<string, unknown>): Promise<T | null> => {
      try {
        const res = await api<T>(`/api/devotion/${id}/action`, { json: payload });
        await load();
        return res;
      } catch (err) {
        setError((err as Error).message);
        return null;
      }
    },
    [id, load],
  );

  const onViewSavedFeedback = useCallback(
    (key: FeedbackStageKey) => {
      if (!d) return;
      const text = d.stageFeedbacks?.[key];
      if (!text?.trim()) return;
      setStageFeedback({
        from: FEEDBACK_STAGE_TITLE[key] ?? key,
        text: text.trim(),
        ragSources: d.stageFeedbackRagSources?.[key],
      });
    },
    [d],
  );

  async function openChapterPicker() {
    if (busy || !d) return;
    setPickerOpen(true);
    if (!books.length) {
      try {
        const res = await api<{ books: BookBrief[] }>('/api/bible/books');
        setBooks(res.books);
      } catch (err) {
        setError((err as Error).message);
        setPickerOpen(false);
      }
    }
  }

  function switchChapter(bookId: number, chapter: number) {
    if (!d) return;
    setPickerOpen(false);
    if (bookId === d.devotion.book_id && chapter === d.devotion.chapter) return;
    setError('');
    // 与首页「灵修」相同：走服务端 start 页创建/找回会话，避免微信里 fetch POST 偶发 Failed to fetch
    const q = new URLSearchParams({ book: String(bookId), chapter: String(chapter) });
    hardNavigate(`/devotion/start?${q}`);
  }

  if (error && !d) {
    return <p className="mx-4 mt-8 rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>;
  }
  if (!d) return <p className="py-20 text-center text-sm text-muted">加载中…</p>;

  const stage = d.devotion.stage;
  const stageIndex = STEPS.findIndex((s) => s.key === stage);

  return (
    <div>
      {stageFeedback && (
        <StageFeedbackSheet
          from={stageFeedback.from}
          text={stageFeedback.text}
          ragSources={stageFeedback.ragSources}
          onClose={() => setStageFeedback(null)}
        />
      )}

      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <PageBackButton fallback="/devotion" />
          {stage !== 'observe' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act({ action: 'retreat' })}
              className="btn-ghost shrink-0 px-3 py-2 text-sm"
            >
              ← 上一步
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={openChapterPicker}
            className="btn-ghost flex min-w-0 flex-1 items-center gap-1 px-3 py-2 text-left"
            aria-label="更换经卷章节"
          >
            <span className="truncate text-[17px] font-bold leading-snug">{d.passage.label}</span>
            <svg
              className="h-4 w-4 shrink-0 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <Stepper current={stageIndex} stage={stage} />
      </header>

      {pickerOpen && d && (
        books.length > 0 ? (
          <BookPicker
            books={books}
            current={{ book: d.devotion.book_id, chapter: d.devotion.chapter }}
            title="换一章灵修"
            onClose={() => setPickerOpen(false)}
            onPick={switchChapter}
          />
        ) : (
          <>
            <div className="fixed inset-0 z-40 bg-ink/35 fade-in" onClick={() => setPickerOpen(false)} />
            <p className="sheet z-40 py-10 text-center text-sm text-muted">加载书目…</p>
          </>
        )
      )}

      <div className="px-4 py-4">
        {error && (
          <p className="mb-4 rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>
        )}

        {stage === 'observe' && (
          <ObserveStage d={d} act={act} sync={sync} busy={busy} reload={load} onViewSavedFeedback={onViewSavedFeedback} />
        )}
        {stage === 'inquire' && (
          <InquireStage d={d} act={act} sync={sync} busy={busy} reload={load} onViewSavedFeedback={onViewSavedFeedback} />
        )}
        {stage === 'reflect' && (
          <ReflectStage d={d} act={act} sync={sync} busy={busy} reload={load} onViewSavedFeedback={onViewSavedFeedback} />
        )}
        {stage === 'guided' && (
          <GuidedStage d={d} act={act} sync={sync} busy={busy} reload={load} onViewSavedFeedback={onViewSavedFeedback} />
        )}
        {stage === 'life' && (
          <LifeStage d={d} act={act} sync={sync} busy={busy} reload={load} onViewSavedFeedback={onViewSavedFeedback} />
        )}
        {stage === 'prayer' && (
          <PrayerStage d={d} act={act} sync={sync} busy={busy} reload={load} onViewSavedFeedback={onViewSavedFeedback} />
        )}
        {stage === 'done' && <DoneStage d={d} />}
      </div>
    </div>
  );
}

type ActFn = <T,>(payload: Record<string, unknown>) => Promise<T | null>;
type SyncFn = ActFn;
type StageProps = {
  d: Detail;
  act: ActFn;
  sync: SyncFn;
  busy: boolean;
  reload: () => Promise<void>;
  onViewSavedFeedback: (stage: FeedbackStageKey) => void;
};

// ---------- 进度条 ----------

function Stepper({ current, stage }: { current: number; stage: Stage }) {
  return (
    <ol className="mt-2.5 flex items-center gap-1">
      {STEPS.map((s, i) => {
        const done = stage === 'done' || i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={`h-1.5 w-full rounded-full transition ${
                done
                  ? 'bg-brand-500 shadow-[0_0_8px_rgb(var(--tw-brand-500)/0.45)]'
                  : active
                    ? 'bg-brand-400 shadow-[0_0_10px_rgb(var(--tw-brand-400)/0.5)]'
                    : 'bg-line'
              }`}
            />
            <span className={`text-[10px] ${active ? 'font-bold text-brand-600' : done ? 'font-medium text-brand-500' : 'text-muted'}`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- 经文（可折叠，长按写笔记） ----------

function Passage({
  bookId,
  bookName,
  chapter,
  devotionId,
  verses,
  notes,
  onNotesChange,
  chapterNotesReviewed,
  emphasis,
  onVerseScroll,
  compactHint,
}: {
  bookId: number;
  bookName: string;
  chapter: number;
  devotionId: number;
  verses: Verse[];
  notes?: Note[];
  chapterNotesReviewed?: boolean;
  onNotesChange: () => Promise<void>;
  /** 观察阶段经文是主界面，给更高的滚动区 */
  emphasis?: boolean;
  onVerseScroll?: (scrollTop: number) => void;
  /** 读经文滚动时收起长按提示，把高度让给正文 */
  compactHint?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [target, setTarget] = useState<VerseTarget | null>(null);
  const [editing, setEditing] = useState<NoteEdit | null>(null);
  const [pressing, setPressing] = useState<number | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  const notesByVerse = new Map<number, Note[]>();
  for (const n of notes ?? []) {
    notesByVerse.set(n.verse, [...(notesByVerse.get(n.verse) ?? []), n]);
  }
  const textNoteCount = (notes ?? []).filter((n) => n.content?.trim()).length;

  function pressStartAt(v: Verse, x: number, y: number) {
    pressCancel();
    startPoint.current = { x, y };
    setPressing(v.verse);
    timer.current = setTimeout(() => {
      navigator.vibrate?.(12);
      setEditing(null);
      setTarget({
        bookId,
        bookName,
        chapter,
        verse: v.verse,
        cn: v.cn,
        en: v.en ?? '',
      });
      setPressing(null);
    }, LONG_PRESS_MS);
  }

  function pressStart(v: Verse, e: React.PointerEvent) {
    if (e.pointerType !== 'touch') {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    pressStartAt(v, e.clientX, e.clientY);
  }

  function touchStart(v: Verse, e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    pressStartAt(v, t.clientX, t.clientY);
  }

  function pressMove(e: React.PointerEvent) {
    if (!startPoint.current) return;
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

  return (
    <section className="card mb-4 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
            <IconScripture size={16} />
          </span>
          <span className="min-w-0">
          <span className="block text-xs font-bold text-ink">经文</span>
          {!open && (
            <span className="mt-0.5 block truncate text-[11px] font-normal text-brand-600">
              展开后长按某一节可写笔记
            </span>
          )}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-muted">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <>
          <div
            className={`mx-4 overflow-hidden transition-all duration-200 ease-out ${
              compactHint ? 'mb-0 max-h-0 opacity-0' : 'mb-2 max-h-24 opacity-100'
            }`}
            role="note"
          >
            <div className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50/90 px-3 py-2.5">
              <IconLongPress className="mt-0.5 shrink-0 text-brand-500" />
              <p className="text-[12px] leading-relaxed text-brand-700">
                <span className="font-semibold">长按</span>任意一节经文，可{' '}
                <span className="font-medium">口述 / 写文字笔记</span>，或标记「神对我说话」
              </p>
            </div>
          </div>
          <ChapterNotesReviewBlock
            bookId={bookId}
            chapter={chapter}
            bookName={bookName}
            textNoteCount={textNoteCount}
            chapterReviewed={chapterNotesReviewed}
          />
          <div
            className={`overflow-y-auto px-2 pb-4 no-bar ${
              emphasis
                ? compactHint
                  ? 'min-h-[50vh] max-h-[calc(100dvh-12.5rem)]'
                  : 'min-h-[44vh] max-h-[62vh]'
                : 'max-h-[38vh]'
            }`}
            onScroll={(e) => onVerseScroll?.(e.currentTarget.scrollTop)}
          >
            {verses.map((v) => {
              const verseNotes = notesByVerse.get(v.verse) ?? [];
              const spoke = verseNotes.some((n) => n.god_spoke);
              return (
                <div
                  key={v.verse}
                  onPointerDown={(e) => pressStart(v, e)}
                  onPointerMove={pressMove}
                  onPointerUp={pressCancel}
                  onPointerCancel={pressCancel}
                  onPointerLeave={pressCancel}
                  onTouchStart={(e) => touchStart(v, e)}
                  onTouchMove={(e) => {
                    if (!startPoint.current || e.touches.length !== 1) return;
                    const t = e.touches[0]!;
                    const slop = 10;
                    if (
                      Math.abs(t.clientX - startPoint.current.x) > slop ||
                      Math.abs(t.clientY - startPoint.current.y) > slop
                    ) {
                      pressCancel();
                    }
                  }}
                  onTouchEnd={pressCancel}
                  onTouchCancel={pressCancel}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`no-select rounded-lg px-2 py-1.5 transition ${
                    pressing === v.verse ? 'bg-brand-100' : ''
                  } ${spoke ? 'border-l-[3px] border-accent bg-accent/[0.04]' : ''}`}
                >
                  <p className={`scripture text-[15px] ${spoke ? 'text-accent' : ''}`}>
                    <sup className="mr-1 select-none align-super text-[11px] font-medium text-brand-300">
                      {v.verse}
                    </sup>
                    {v.cn}
                    {verseNotes.length > 0 && (
                      <span className="ml-1.5 inline-flex align-middle items-center gap-1 text-[11px] text-accent">
                        {verseNotes.some((n) => n.kind === 'audio') && '🎙'}
                        {verseNotes.some((n) => n.kind === 'text') && '·'}
                        {verseNotes.some((n) => n.readerReviewed && n.content?.trim()) && (
                          <NoteReviewedBadge className="h-3.5 w-3.5" />
                        )}
                      </span>
                    )}
                    <VerseLongPressHint />
                  </p>
                  {verseNotes
                    .filter((n) => n.content || n.media_path)
                    .map((n) => (
                      <div key={n.id} className="verse-note">
                        {n.content && (
                          <>
                            <p
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTarget({
                                  bookId,
                                  bookName,
                                  chapter,
                                  verse: v.verse,
                                  cn: v.cn,
                                  en: v.en ?? '',
                                });
                                setEditing({
                                  id: n.id,
                                  content: n.content,
                                  godSpoke: !!n.god_spoke,
                                  readerReviewed: n.readerReviewed,
                                });
                              }}
                              className="verse-note-text"
                              title={n.content.length > 48 ? n.content : undefined}
                            >
                              {n.content}
                            </p>
                            <div onPointerDown={(e) => e.stopPropagation()}>
                              <NoteReviewBlock
                                noteId={n.id}
                                refLabel={`${bookName} ${chapter}:${v.verse}`}
                                compact
                                readerReviewed={n.readerReviewed}
                              />
                            </div>
                          </>
                        )}
                        {n.kind === 'audio' && n.media_path && (
                          <audio src={`/api/media/${n.media_path}`} controls className="verse-note-audio w-full" />
                        )}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {target && (
        <NoteSheet
          target={target}
          devotionId={devotionId}
          editing={editing}
          onClose={() => {
            setTarget(null);
            setEditing(null);
          }}
          onSaved={onNotesChange}
        />
      )}
    </section>
  );
}

function passageBookName(label: string) {
  return label.replace(/\s+\d+:.*$/, '');
}

/** 阶段说明卡：每一步先说清"这一步要你做什么" */
/** 在经文区内滚动阅读时，收起阶段说明与长按提示，把空间让给经文 */
function useReadingCompact() {
  const [readingCompact, setReadingCompact] = useState(false);
  const onVerseScroll = useCallback((scrollTop: number) => {
    setReadingCompact(scrollTop > 10);
  }, []);
  return { readingCompact, onVerseScroll };
}

function DevotionPassage({
  d,
  reload,
  readingCompact,
  onVerseScroll,
  emphasis,
}: {
  d: Detail;
  reload: () => Promise<void>;
  readingCompact: boolean;
  onVerseScroll: (scrollTop: number) => void;
  emphasis?: boolean;
}) {
  return (
    <Passage
      bookId={d.devotion.book_id}
      bookName={passageBookName(d.passage.label)}
      chapter={d.devotion.chapter}
      devotionId={d.devotion.id}
      verses={d.passage.verses}
      notes={d.notes}
      chapterNotesReviewed={d.chapterNotesReviewed}
      onNotesChange={reload}
      emphasis={emphasis}
      compactHint={readingCompact}
      onVerseScroll={onVerseScroll}
    />
  );
}

function StageIntro({
  title,
  children,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden transition-[margin,max-height] duration-200 ease-out ${
        compact ? 'mb-1 max-h-8' : 'mb-4 max-h-96'
      }`}
    >
      <h2
        className={`font-bold tracking-tight text-ink transition-all duration-200 ${
          compact ? 'truncate text-sm text-brand-700' : 'text-[20px]'
        }`}
      >
        {title}
      </h2>
      <div
        className={`grid transition-all duration-200 ease-out ${
          compact ? 'grid-rows-[0fr] opacity-0' : 'mt-2 grid-rows-[1fr] opacity-100'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="text-[14px] font-medium leading-relaxed text-muted">{children}</p>
        </div>
      </div>
    </div>
  );
}

function SavedStageFeedbackButton({
  stage,
  feedback,
  onView,
}: {
  stage: FeedbackStageKey;
  feedback?: string;
  onView: (stage: FeedbackStageKey) => void;
}) {
  if (!feedback?.trim()) return null;
  return (
    <button
      type="button"
      className="btn-secondary mb-2 py-2.5 text-sm"
      onClick={() => onView(stage)}
    >
      查看陪读者对「{FEEDBACK_STAGE_TITLE[stage]}」的点评
    </button>
  );
}

function NextButton({
  gate,
  onNext,
  busy,
  label = '进入下一步',
  savedFeedback,
  feedbackStage,
  onViewSavedFeedback,
}: {
  gate: { ok: boolean; reason?: string };
  onNext: () => void;
  busy: boolean;
  label?: string;
  savedFeedback?: string;
  feedbackStage?: FeedbackStageKey;
  onViewSavedFeedback?: (stage: FeedbackStageKey) => void;
}) {
  return (
    <div className="mt-5">
      {feedbackStage && onViewSavedFeedback && (
        <SavedStageFeedbackButton stage={feedbackStage} feedback={savedFeedback} onView={onViewSavedFeedback} />
      )}
      <button className="btn-primary w-full py-3" onClick={onNext} disabled={busy || !gate.ok}>
        {busy ? '陪读者在读你写的内容…' : label}
      </button>
      {!gate.ok && gate.reason && (
        <p className="mt-2 text-center text-xs text-muted">{gate.reason}</p>
      )}
    </div>
  );
}

/** 浮动「考一考」：滚到答题区并聚焦，始终浮在底部 Tab 上方 */
function QuizMeButton({
  targetRef,
  disabled,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
}) {
  function go() {
    targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      const el = targetRef.current?.querySelector('textarea, input:not([type=checkbox])') as
        | HTMLTextAreaElement
        | HTMLInputElement
        | null;
      el?.focus({ preventScroll: true });
    }, 320);
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={disabled}
      aria-label="考一考，前往下方答题区"
      style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-b) + 12px)' }}
      className="fixed right-4 z-30 flex h-9 items-center gap-1 rounded-full border border-brand-300/90 bg-card/95 py-0 pl-0.5 pr-2.5 shadow-md backdrop-blur-md active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white"
        aria-hidden
      >
        考
      </span>
      <span className="text-[13px] font-bold text-brand-700">考一考</span>
    </button>
  );
}

function AnswerZone({
  zoneRef,
  title = '答题区',
  children,
}: {
  zoneRef: React.RefObject<HTMLElement | null>;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      ref={zoneRef}
      className="scroll-mt-28 rounded-xl border border-dashed border-brand-300/80 bg-gradient-to-b from-brand-50/90 to-card px-3 py-3 shadow-sm"
    >
      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-brand-700">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
        {title}
      </p>
      {children}
    </section>
  );
}

/** 点「下一步」后，陪读者对刚写内容的短评 */
function StageFeedbackSheet({
  from,
  text,
  ragSources,
  onClose,
}: {
  from: string;
  text: string;
  ragSources?: RagSource[];
  onClose: () => void;
}) {
  return (
    <SheetModal onClose={onClose} zBackdrop={85} zSheet={95} className="max-h-[75vh]">
      <div className="px-5 pb-6">
        <div className="pt-3 pr-10">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <p className="text-[15px] font-semibold">陪读者点评</p>
          <p className="mt-0.5 text-xs text-muted">关于你刚完成的「{from}」</p>
        </div>
        <div className="mt-4 rounded-xl bg-brand-50/80 px-4 py-3.5">
          <p className="whitespace-pre-wrap text-[15px] leading-[1.85] text-ink/90">{text}</p>
          <RagSourcesFootnote sources={ragSources} />
        </div>
        <button type="button" className="btn-primary mt-5 w-full py-3" onClick={onClose}>
          继续
        </button>
      </div>
    </SheetModal>
  );
}

// ---------- 1. 观察 ----------

function ObserveStage({ d, act, sync, busy, reload, onViewSavedFeedback }: StageProps) {
  const [nudges, setNudges] = useState<string[] | null>(null);
  const [nudgeBusy, setNudgeBusy] = useState(false);
  const { readingCompact, onVerseScroll } = useReadingCompact();
  const answerRef = useRef<HTMLElement>(null);
  const saved = d.inputs.filter((i) => i.kind === 'observation');
  const { text, setText, onBlur, draftId } = useAutoSaveDevotionText({
    save: sync,
    kind: 'observation',
    minChars: 2,
  });
  const archived = saved.filter((i) => i.id !== draftId);

  async function askForHelp() {
    setNudgeBusy(true);
    try {
      const res = await api<{ questions: string[] }>(
        `/api/devotion/nudge?book=${d.devotion.book_id}&chapter=${d.devotion.chapter}`,
      );
      setNudges(res.questions);
    } finally {
      setNudgeBusy(false);
    }
  }

  return (
    <div>
      <StageIntro title="先写下你看见的" compact={readingCompact}>
        还不要写感想和心得。只写经文里<strong className="font-medium text-ink">确实存在</strong>的东西：
        谁、在什么时候、在哪里、做了什么、事情怎么一步步推过来的。写下来你才会发现自己漏掉了什么。
      </StageIntro>

      <DevotionPassage
        d={d}
        reload={reload}
        readingCompact={readingCompact}
        onVerseScroll={onVerseScroll}
        emphasis
      />

      <QuizMeButton targetRef={answerRef} />

      <AnswerZone zoneRef={answerRef} title="考一考 · 观察答题区">
        {archived.length > 0 && (
          <ul className="mb-3 space-y-2">
            {archived.map((i) => (
              <li key={i.id} className="card flex items-start gap-2 px-4 py-3">
                <p className="flex-1 text-[14px] leading-relaxed">{i.content}</p>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2 py-1 text-xs"
                  onClick={() => act({ action: 'removeInput', inputId: i.id })}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          className="field min-h-[130px] resize-none"
          placeholder="考一考：按顺序写出你看见的人、地点、动作……答不全也没关系，写几条算几条"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={onBlur}
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-xs text-muted">
            已保存 {saved.length} 条{saved.length === 0 ? '，写满一条即可下一步' : '，停笔会自动保存'}
          </span>
          <Dictate onText={(t) => setText((prev) => joinDictation(prev, t))} disabled={busy} />
        </div>

        {/* R-D5 兜底参考题 */}
        <div className="mt-4 border-t border-line pt-3">
          {!nudges ? (
            <button
              type="button"
              className="btn-secondary py-2.5 text-sm"
              onClick={askForHelp}
              disabled={nudgeBusy}
            >
              {nudgeBusy ? '出题中…' : '考一考卡住了？换几道参考题'}
            </button>
          ) : (
            <div className="rounded-lg bg-brand-50/60 px-3 py-2.5">
              <p className="label mb-2">参考题（挑一题在上方作答）</p>
              <ul className="space-y-2">
                {nudges.map((q, i) => (
                  <li key={i} className="text-[14px] leading-relaxed text-ink/90">
                    {i + 1}. {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AnswerZone>

      <NextButton
        gate={d.gate}
        busy={busy}
        onNext={() => act({ action: 'advance' })}
        label="下一步：自己提问"
        feedbackStage="observe"
        savedFeedback={d.stageFeedbacks?.observe}
        onViewSavedFeedback={onViewSavedFeedback}
      />
    </div>
  );
}

// ---------- 2. 自己提问 ----------

function InquireStage({ d, act, sync, busy, reload, onViewSavedFeedback }: StageProps) {
  const { readingCompact, onVerseScroll } = useReadingCompact();
  const answerRef = useRef<HTMLElement>(null);
  const questions = d.inputs.filter((i) => i.kind === 'question');
  const { text, setText, onBlur, flushNow, draftId } = useAutoSaveDevotionText({
    save: sync,
    kind: 'question',
    minChars: 5,
    resetAfterSave: false,
  });
  const listed = questions.filter((q) => q.id !== draftId);

  return (
    <div>
      <StageIntro title="现在换你提问" compact={readingCompact}>
        这一步不是回答问题，是<strong className="font-medium text-ink">你自己提问</strong>。
        把读的时候心里冒出来的疑问、卡住的地方、觉得不对劲的地方写出来。
        不用怕问得幼稚，问那种你自己都答不上来的问题最好。
      </StageIntro>

      <DevotionPassage
        d={d}
        reload={reload}
        readingCompact={readingCompact}
        onVerseScroll={onVerseScroll}
        emphasis
      />

      <QuizMeButton targetRef={answerRef} />

      <div
        className={`overflow-hidden bg-brand-50/60 transition-all duration-200 ease-out ${
          readingCompact ? 'mb-0 max-h-0 opacity-0' : 'card mb-4 max-h-40 px-4 py-3 opacity-100'
        }`}
      >
        <p className="label mb-1.5">考一考 · 提问角度</p>
        <p className="text-[13px] leading-relaxed text-brand-700">
          他为什么这样做？这里为什么突然提到……？这句话和前面那句是不是有矛盾？
          如果我在场我会怎么反应？神为什么允许这件事？
        </p>
      </div>

      <AnswerZone zoneRef={answerRef} title="考一考 · 提问答题区">
        {listed.length > 0 && (
          <ul className="mb-3 space-y-2">
            {listed.map((q, n) => (
              <li key={q.id} className="card flex items-start gap-2 px-4 py-3">
                <span className="mt-0.5 text-xs text-brand-300">{n + 1}</span>
                <p className="flex-1 text-[14px] leading-relaxed">{q.content}</p>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2 py-1 text-xs"
                  onClick={() => act({ action: 'removeInput', inputId: q.id })}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          className="field w-full"
          placeholder="考一考：写下你的一个问题（越难越好）…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void flushNow();
            }
          }}
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-xs text-muted">
            已保存 {questions.length} 个问题（至少 1 个，停笔自动保存）
          </p>
          <Dictate
            onText={(t) => setText((prev) => joinDictation(prev, t, ' '))}
            disabled={busy}
            hint="说完自动填进上面的问题框"
          />
        </div>
      </AnswerZone>

      <NextButton
        gate={d.gate}
        busy={busy}
        onNext={() => act({ action: 'advance' })}
        label="下一步：默想作答"
        feedbackStage="inquire"
        savedFeedback={d.stageFeedbacks?.inquire}
        onViewSavedFeedback={onViewSavedFeedback}
      />
    </div>
  );
}

// ---------- 3. 默想作答 + 评分 ----------

function ReflectAnswerField({
  promptId,
  question,
  layer,
  bridge,
  saved,
  sync,
  busy,
  onRemove,
}: {
  promptId: number;
  question: string;
  layer: string;
  bridge: string | null;
  saved: Input | undefined;
  sync: SyncFn;
  busy: boolean;
  onRemove: () => void;
}) {
  const seed = saved ? { id: saved.id, content: saved.content } : null;
  const { text, setText, onBlur } = useAutoSaveDevotionText({
    save: sync,
    kind: 'answer',
    minChars: 2,
    promptId,
    seed,
  });

  return (
    <div className="card px-4 py-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="chip">{LAYER_LABEL[layer] ?? layer}</span>
        {bridge && <span className="chip bg-accent/10 text-accent">{bridge}</span>}
      </div>
      <p className="text-[15px] font-medium leading-relaxed">{question}</p>
      <div className="mt-2.5">
        <textarea
          className="field min-h-[86px] resize-none"
          placeholder="考一考：这道题你怎么答？想到什么写什么，不用组织得很漂亮"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={onBlur}
        />
        <div className="mt-2 flex items-center gap-2">
          {saved && (
            <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" onClick={onRemove}>
              清空重答
            </button>
          )}
          <Dictate
            onText={(t) => setText((prev) => joinDictation(prev, t))}
            disabled={busy}
            hint="说完自动填进这一题的答题框"
          />
        </div>
      </div>
    </div>
  );
}

function ReflectStage({ d, act, sync, busy, reload, onViewSavedFeedback }: StageProps) {
  const { readingCompact, onVerseScroll } = useReadingCompact();
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [scoreResult, setScoreResult] = useState<{
    total: number;
    unlocked: boolean;
    scores: Score[];
    encouragement: string;
    degraded: boolean;
    ragSources?: RagSource[];
  } | null>(null);
  const asked = useRef(false);
  const answerRef = useRef<HTMLElement>(null);

  // 进入本阶段自动出题（四层思辨题）
  useEffect(() => {
    if (d.prompts.length || asked.current) return;
    asked.current = true;
    setLoadingPrompts(true);
    act({ action: 'prompts' }).finally(() => setLoadingPrompts(false));
  }, [d.prompts.length, act]);

  const savedAnswers = d.inputs.filter((i) => i.kind === 'answer');
  const myQuestions = d.inputs.filter((i) => i.kind === 'question');

  async function evaluate() {
    const res = await act<typeof scoreResult>({ action: 'score' });
    if (res) setScoreResult(res);
  }

  const unlocked = Boolean(d.devotion.unlocked);

  return (
    <div>
      <StageIntro title="用你自己的话回答" compact={readingCompact}>
        下面的问题没有标准答案，也不是考试。答完之后会有一次评估 ——
        评的不是你答得对不对，而是你有没有真的自己想过。达到 {d.unlockScore} 分才开启引导。
      </StageIntro>

      <DevotionPassage
        d={d}
        reload={reload}
        readingCompact={readingCompact}
        onVerseScroll={onVerseScroll}
        emphasis
      />

      {myQuestions.length > 0 && (
        <div
          className={`overflow-hidden bg-brand-50/60 transition-all duration-200 ease-out ${
            readingCompact ? 'mb-0 max-h-0 opacity-0' : 'card mb-4 max-h-48 px-4 py-3 opacity-100'
          }`}
        >
          <p className="label mb-1.5">你自己提的问题（等会儿引导会先回应它们）</p>
          <ul className="space-y-1">
            {myQuestions.map((q, i) => (
              <li key={q.id} className="text-[13px] leading-relaxed text-brand-700">
                {i + 1}. {q.content}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadingPrompts && <Waiting text="正在为你出题…" expect="通常 20-40 秒" />}

      <QuizMeButton targetRef={answerRef} disabled={!loadingPrompts && !d.prompts.length} />

      <AnswerZone zoneRef={answerRef} title="考一考 · 默想答题区">
      <div className="space-y-3">
        {d.prompts.map((p) => {
          const mine = savedAnswers.find((a) => a.prompt_id === p.id);
          return (
            <ReflectAnswerField
              key={`${p.id}-${mine?.id ?? 'new'}`}
              promptId={p.id}
              question={p.question}
              layer={p.layer}
              bridge={p.bridge}
              saved={mine}
              sync={sync}
              busy={busy}
              onRemove={() => mine && act({ action: 'removeInput', inputId: mine.id })}
            />
          );
        })}
      </div>

      {/* 评分区 */}
      <div className="mt-6">
        {(scoreResult || d.scores.length > 0) && (
          <ScoreCard
            total={scoreResult?.total ?? d.devotion.score}
            unlockScore={d.unlockScore}
            scores={scoreResult?.scores ?? d.scores}
            encouragement={scoreResult?.encouragement}
            degraded={scoreResult?.degraded}
            ragSources={scoreResult?.ragSources}
          />
        )}

        {!unlocked ? (
          <>
            <button className="btn-primary mt-3 w-full py-3" onClick={evaluate} disabled={busy || !savedAnswers.length}>
              {busy ? '评估中…' : d.scores.length ? '修改后重新评估' : '提交，看看我想得怎么样'}
            </button>
            {!savedAnswers.length && (
              <p className="mt-2 text-center text-xs text-muted">先回答至少一道题</p>
            )}
          </>
        ) : (
          <div className="mt-3">
            <SavedStageFeedbackButton
              stage="reflect"
              feedback={d.stageFeedbacks?.reflect}
              onView={onViewSavedFeedback}
            />
            <button className="btn-primary w-full py-3" onClick={() => act({ action: 'advance' })} disabled={busy}>
              {busy ? '陪读者在读你写的内容…' : '已解锁 · 进入引导'}
            </button>
          </div>
        )}
      </div>
      </AnswerZone>
    </div>
  );
}

function ScoreCard({
  total,
  unlockScore,
  scores,
  encouragement,
  degraded,
  ragSources,
}: {
  total: number;
  unlockScore: number;
  scores: Score[];
  encouragement?: string;
  degraded?: boolean;
  ragSources?: RagSource[];
}) {
  const pass = total >= unlockScore;
  return (
    <div className="card px-4 py-4">
      <div className="mb-3 flex items-baseline gap-2">
        <span className={`text-[32px] font-semibold ${pass ? 'text-brand-500' : 'text-accent'}`}>{total}</span>
        <span className="text-xs text-muted">/ 100 · 解锁线 {unlockScore}</span>
        {degraded && <span className="chip ml-auto">离线评估</span>}
      </div>

      <div className="space-y-2.5">
        {scores.map((s) => (
          <div key={s.dimension}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted">{DIM_LABEL[s.dimension] ?? s.dimension}</span>
              <span className="tabular-nums text-ink">{s.score}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${s.score >= unlockScore ? 'bg-brand-500' : 'bg-accent/70'}`}
                style={{ width: `${Math.max(3, Math.min(100, s.score))}%` }}
              />
            </div>
            {s.reason && <p className="mt-1 text-[12px] leading-relaxed text-muted">{s.reason}</p>}
          </div>
        ))}
      </div>

      {encouragement && (
        <div className="mt-3 rounded-xl bg-brand-50 px-3.5 py-2.5">
          <p className="text-[13px] leading-relaxed text-brand-700">{encouragement}</p>
          <RagSourcesFootnote sources={ragSources} />
        </div>
      )}
      {!pass && (
        <p className="mt-3 text-[13px] leading-relaxed text-accent">
          还没到解锁线。这不是要难为你 —— 是因为现在给你答案，
          就把你自己能发现的那份夺走了。回上面再往里想一层。
        </p>
      )}
    </div>
  );
}

// ---------- 4. 引导揭晓 + 对话 ----------

function GuidedStage({ d, act, busy, reload, onViewSavedFeedback }: StageProps) {
  const { readingCompact, onVerseScroll } = useReadingCompact();
  const [text, setTextInternal] = useState('');
  const [coachSending, setCoachSending] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [streamRagSources, setStreamRagSources] = useState<RagSource[]>([]);
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'writing' | 'done'>('idle');
  const [streamError, setStreamError] = useState('');
  const requested = useRef(false);
  const coachTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastCoachSentRef = useRef('');
  const answerRef = useRef<HTMLElement>(null);
  const coachMsgs = d.coach;

  const flushCoach = useCallback(
    async (raw: string) => {
      const t = raw.trim();
      if (t.length < 2 || t === lastCoachSentRef.current || coachSending || busy) return;
      setCoachSending(true);
      const ok = await act({ action: 'coach', text: t });
      if (ok) {
        lastCoachSentRef.current = t;
        setTextInternal('');
      }
      setCoachSending(false);
    },
    [act, busy, coachSending],
  );

  const setText = useCallback(
    (next: string | ((p: string) => string)) => {
      setTextInternal((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        if (coachTimerRef.current) clearTimeout(coachTimerRef.current);
        coachTimerRef.current = setTimeout(() => void flushCoach(value), 900);
        return value;
      });
    },
    [flushCoach],
  );

  useEffect(
    () => () => {
      if (coachTimerRef.current) clearTimeout(coachTimerRef.current);
    },
    [],
  );

  // 首次进入本阶段：用 SSE 逐字接收引导，避免干等 1-2 分钟
  useEffect(() => {
    if (coachMsgs.length || requested.current) return;
    requested.current = true;
    let cancelled = false;

    (async () => {
      setPhase('thinking');
      try {
        const res = await fetch(`/api/devotion/${d.devotion.id}/guide-stream`, { method: 'POST' });
        if (!res.ok || !res.body) {
          const info = await res.json().catch(() => ({ error: '引导生成失败' }));
          throw new Error(info.error ?? '引导生成失败');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            const event = JSON.parse(line.slice(5).trim());
            if (event.type === 'delta') {
              setPhase('writing');
              setStreaming((prev) => prev + event.text);
            } else if (event.type === 'error') {
              throw new Error(event.message);
            } else if (event.type === 'done') {
              setPhase('done');
              if (Array.isArray(event.ragSources)) setStreamRagSources(event.ragSources);
            }
          }
        }
        if (!cancelled) await reload(); // 让落库后的消息进入正式列表
      } catch (err) {
        if (!cancelled) {
          setStreamError((err as Error).message);
          setPhase('idle');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coachMsgs.length, d.devotion.id, reload]);

  return (
    <div>
      <StageIntro title="陪读者的回应" compact={readingCompact}>
        接下来的话是顺着你写的内容说的，不是标准答案。
        如果你不同意，就直接说出来 —— 那正是你自己在思考的证据。
      </StageIntro>

      <DevotionPassage
        d={d}
        reload={reload}
        readingCompact={readingCompact}
        onVerseScroll={onVerseScroll}
        emphasis
      />

      <QuizMeButton targetRef={answerRef} />

      {streamError && (
        <p className="mb-3 rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{streamError}</p>
      )}

      {phase === 'thinking' && !streaming && (
        <Waiting text="陪读者正在读你写下的每一句…" expect="它在默想，通常 30-90 秒开始回应" />
      )}

      {/* 流式文本：还没落库前先显示这一份 */}
      {streaming && !coachMsgs.length && (
        <div className="card px-4 py-3.5">
          <p className="label mb-1.5">陪读者</p>
          <div className="space-y-2">
            {streaming.split('\n').filter(Boolean).map((para, k) => (
              <p key={k} className="text-[14.5px] leading-[1.85] text-ink/90">
                {para}
              </p>
            ))}
          </div>
          {phase === 'writing' && (
            <span className="mt-1 inline-block h-4 w-[2px] animate-pulse bg-brand-500 align-middle" />
          )}
          <RagSourcesFootnote sources={phase === 'done' ? streamRagSources : undefined} />
        </div>
      )}

      <div className="space-y-3">
        {coachMsgs.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'coach'
                ? 'card px-4 py-3.5'
                : 'ml-8 rounded-2xl bg-brand-500 px-4 py-3 text-white'
            }
          >
            {m.role === 'coach' && <p className="label mb-1.5">陪读者</p>}
            <div className="space-y-2">
              {m.content.split('\n').filter(Boolean).map((para, k) => (
                <p key={k} className={`text-[14.5px] leading-[1.85] ${m.role === 'coach' ? 'text-ink/90' : ''}`}>
                  {para}
                </p>
              ))}
            </div>
            {m.role === 'coach' && <RagSourcesFootnote sources={m.ragSources} />}
          </div>
        ))}
      </div>

      <AnswerZone zoneRef={answerRef} title="考一考 · 回应答题区">
        {(coachMsgs.length > 0 || phase === 'done') ? (
          <>
            <textarea
              className="field min-h-[86px] resize-none"
              placeholder="考一考：陪读者哪一点触动了你？写一句回应或你的不同意…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => {
                if (coachTimerRef.current) clearTimeout(coachTimerRef.current);
                void flushCoach(text);
              }}
            />
            <div className="mt-2 space-y-2">
              <SavedStageFeedbackButton
                stage="guided"
                feedback={d.stageFeedbacks?.guided}
                onView={onViewSavedFeedback}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Dictate onText={(t) => setText((prev) => joinDictation(prev, t))} disabled={busy || coachSending} />
                <p className="flex-1 text-xs text-muted">
                  {coachSending || busy ? '陪读者在回应…' : '停笔后会自动发送并继续对话'}
                </p>
                <button
                  className="btn-primary shrink-0 px-4"
                  onClick={() => act({ action: 'advance' })}
                  disabled={busy || coachSending}
                >
                  记生命实事
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="py-2 text-sm leading-relaxed text-muted">
            陪读者的回应出来以后，在这里考一考自己、写下你的回应。
          </p>
        )}
      </AnswerZone>
    </div>
  );
}

// ---------- 5. 生命实事 ----------

function LifeStage({ d, act, sync, busy, reload, onViewSavedFeedback }: StageProps) {
  const { readingCompact, onVerseScroll } = useReadingCompact();
  const answerRef = useRef<HTMLElement>(null);
  const facts = d.inputs.filter((i) => i.kind === 'life_fact');
  const { text, setText, onBlur, draftId } = useAutoSaveDevotionText({
    save: sync,
    kind: 'life_fact',
    minChars: 2,
  });
  const archived = facts.filter((f) => f.id !== draftId);

  return (
    <div>
      <StageIntro title="记下你生命里的实事" compact={readingCompact}>
        灵修不是想法的练习，是生命的事。写一件<strong className="font-medium text-ink">真实发生过的事</strong>：
        这周你经历的、你看到的现象、让你难受或欣喜的那件具体的事。
        有了实事，等一下的祷告才有内容。
      </StageIntro>

      <DevotionPassage
        d={d}
        reload={reload}
        readingCompact={readingCompact}
        onVerseScroll={onVerseScroll}
        emphasis
      />

      <QuizMeButton targetRef={answerRef} />

      <AnswerZone zoneRef={answerRef} title="考一考 · 生命实事答题区">
        {archived.length > 0 && (
          <ul className="mb-3 space-y-2">
            {archived.map((f) => (
              <li key={f.id} className="card flex items-start gap-2 px-4 py-3">
                <p className="flex-1 text-[14px] leading-relaxed">{f.content}</p>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2 py-1 text-xs"
                  onClick={() => act({ action: 'removeInput', inputId: f.id })}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          className="field min-h-[120px] resize-none"
          placeholder="考一考：这周有没有一件真实的小事，和刚才读的经文对得上？"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={onBlur}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted">停笔会自动保存</p>
          <Dictate onText={(t) => setText((prev) => joinDictation(prev, t))} disabled={busy} />
        </div>
      </AnswerZone>

      <NextButton
        gate={d.gate}
        busy={busy}
        onNext={() => act({ action: 'advance' })}
        label="下一步：祷告回应"
        feedbackStage="life"
        savedFeedback={d.stageFeedbacks?.life}
        onViewSavedFeedback={onViewSavedFeedback}
      />
    </div>
  );
}

// ---------- 6. 祷告 ----------

function PrayerStage({ d, act, sync, busy, reload, onViewSavedFeedback: _onViewSavedFeedback }: StageProps) {
  const { readingCompact, onVerseScroll } = useReadingCompact();
  const answerRef = useRef<HTMLElement>(null);
  const prayers = d.inputs.filter((i) => i.kind === 'prayer');
  const facts = d.inputs.filter((i) => i.kind === 'life_fact');
  const { text, setText, onBlur, draftId } = useAutoSaveDevotionText({
    save: sync,
    kind: 'prayer',
    minChars: 2,
  });
  const archived = prayers.filter((p) => p.id !== draftId);

  return (
    <div>
      <StageIntro title="把话说回给神" compact={readingCompact}>
        到这里才是完整的一次灵修：你看见了、你问了、你想了、你想起自己的生命，
        现在把这些带到神面前说出来。
      </StageIntro>

      <DevotionPassage
        d={d}
        reload={reload}
        readingCompact={readingCompact}
        onVerseScroll={onVerseScroll}
        emphasis
      />

      {facts.length > 0 && (
        <div
          className={`overflow-hidden bg-brand-50/60 transition-all duration-200 ease-out ${
            readingCompact ? 'mb-0 max-h-0 opacity-0' : 'card mb-4 px-4 py-3 opacity-100'
          }`}
        >
          <p className="label mb-1.5">你刚才写的实事</p>
          {facts.map((f) => (
            <p key={f.id} className="text-[13px] leading-relaxed text-brand-700">
              {f.content}
            </p>
          ))}
        </div>
      )}

      <QuizMeButton targetRef={answerRef} />

      <AnswerZone zoneRef={answerRef} title="考一考 · 祷告答题区">
        {archived.length > 0 && (
          <ul className="mb-3 space-y-2">
            {archived.map((p) => (
              <li key={p.id} className="card px-4 py-3">
                <p className="scripture text-[14.5px]">{p.content}</p>
                <button
                  type="button"
                  className="btn-ghost mt-2 px-2 py-1 text-xs"
                  onClick={() => act({ action: 'removeInput', inputId: p.id })}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          className="field min-h-[140px] resize-none"
          placeholder="考一考：主啊，今天这段经文和你刚才想起的事，你想对神说什么？"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={onBlur}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted">停笔会自动保存</p>
          <Dictate onText={(t) => setText((prev) => joinDictation(prev, t))} disabled={busy} hint="说完自动填进上面的祷告框" />
        </div>
      </AnswerZone>

      <NextButton gate={d.gate} busy={busy} onNext={() => act({ action: 'complete' })} label="完成这次灵修" />
    </div>
  );
}

// ---------- 7. 完成卡片 ----------

function DoneStage({ d }: { d: Detail }) {
  const pick = (kind: string) => d.inputs.filter((i) => i.kind === kind);
  const sections: [string, Input[]][] = [
    ['我看见的', pick('observation')],
    ['我问的', pick('question')],
    ['我想的', pick('answer')],
    ['我的生命实事', pick('life_fact')],
    ['我的祷告', pick('prayer')],
  ];

  return (
    <div>
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl text-brand-500">
          ✓
        </div>
        <h2 className="text-[19px] font-semibold">这一次灵修完整了</h2>
        <p className="mt-1.5 text-sm text-muted">
          {d.passage.label} · 评估 {d.devotion.score} 分
          {d.devotion.completed_at ? ` · ${d.devotion.completed_at.slice(0, 10)}` : ''}
        </p>
      </div>

      <div className="space-y-3">
        {sections
          .filter(([, items]) => items.length)
          .map(([label, items]) => (
            <section key={label} className="card px-4 py-3.5">
              <p className="label mb-2">{label}</p>
              <div className="space-y-1.5">
                {items.map((i) => (
                  <p key={i.id} className="text-[14px] leading-relaxed text-ink/90">
                    {i.content}
                  </p>
                ))}
              </div>
            </section>
          ))}

        {d.coach.filter((m) => m.role === 'coach').length > 0 && (
          <section className="card px-4 py-3.5">
            <p className="label mb-2">陪读者说过的话</p>
            {d.coach
              .filter((m) => m.role === 'coach')
              .map((m, i) => (
                <p key={i} className="mb-2 text-[13.5px] leading-relaxed text-muted">
                  {m.content}
                </p>
              ))}
          </section>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Link
          href={`/devotion?tab=explore&book=${d.devotion.book_id}&chapter=${d.devotion.chapter}`}
          className="btn-ghost flex-1"
        >
          看这章的图谱
        </Link>
        <Link href="/devotion" className="btn-primary flex-1">
          返回灵修列表
        </Link>
      </div>
    </div>
  );
}
