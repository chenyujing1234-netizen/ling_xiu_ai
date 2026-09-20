'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { joinDictation, transcribe } from '@/lib/dictate';
import Recorder from './Recorder';
import NoteReviewBlock from './NoteReviewBlock';

export type VerseTarget = {
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  cn: string;
  en: string;
};

type Tab = 'text' | 'audio';

const TABS: { key: Tab; label: string }[] = [
  { key: 'text', label: '写下' },
  { key: 'audio', label: '口述' },
];

/** 记住上次用的输入方式（写下 / 口述） */
const PREF_KEY = 'lx_note_input';

function lastUsedInput(): Tab {
  if (typeof window === 'undefined') return 'text';
  const v = window.localStorage.getItem(PREF_KEY) as Tab | null;
  return v === 'text' || v === 'audio' ? v : 'text';
}

/** 改一条已记下的笔记时传进来 */
export type NoteEdit = { id: number; content: string; godSpoke: boolean };

export default function NoteSheet({
  target,
  devotionId,
  editing,
  onClose,
  onSaved,
}: {
  target: VerseTarget;
  devotionId?: number | null;
  editing?: NoteEdit | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  // 改旧笔记就直接进"写下"，这时候要的是改字，不是换输入方式
  const [tab, setTab] = useState<Tab>(editing ? 'text' : lastUsedInput);
  const [text, setText] = useState(editing?.content ?? '');
  const [godSpoke, setGodSpoke] = useState(editing?.godSpoke ?? false);
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const ref = `${target.bookName} ${target.chapter}:${target.verse}`;

  const godSpokeBox = (
    <label className="flex items-center gap-2.5 py-1 text-sm">
      <input
        type="checkbox"
        className="h-[18px] w-[18px] accent-brand-500"
        checked={godSpoke}
        onChange={(e) => setGodSpoke(e.target.checked)}
      />
      <span>这一节神对我说话</span>
    </label>
  );

  function pickTab(t: Tab) {
    setTab(t);
    try {
      window.localStorage.setItem(PREF_KEY, t);
    } catch {
      /* 隐私模式下写不进去就算了，不影响本次使用 */
    }
  }

  // 打开面板时锁住背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function done(message: string, hold = 700) {
    setToast(message);
    onSaved?.();
    setTimeout(onClose, hold);
  }

  async function saveNote(content: string) {
    if (editing) {
      await api('/api/notes', {
        method: 'PATCH',
        json: { id: editing.id, content, godSpoke },
      });
      return;
    }
    await api('/api/notes', {
      json: {
        bookId: target.bookId,
        chapter: target.chapter,
        verse: target.verse,
        content,
        godSpoke,
        devotionId: devotionId ?? null,
      },
    });
  }

  async function removeNote() {
    if (!editing) return;
    setError('');
    setBusy(true);
    try {
      await api(`/api/notes?id=${editing.id}`, { method: 'DELETE' });
      done('已删掉');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function saveText() {
    if (!text.trim() && !godSpoke) {
      setError('写点什么再保存吧');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await saveNote(text.trim());
      done(editing ? '已改好' : '已记下');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * 口述转文字。音频只是中转，不保存成文件；
   * 转出来的字**直接入库**，不再落到"写下"里等他确认 ——
   * 说完就记下才是口述的意义，要改可以回头点开这条笔记。
   */
  async function speakToText(blob: Blob) {
    setError('');
    setToast('');
    setTranscribing(true);
    try {
      const said = await transcribe(blob);
      if (!said) {
        setError('没听清，再说一次');
        return;
      }
      // 万一他先打了半句又改用口述，两段都留下，不能把打的字冲掉
      await saveNote(joinDictation(text, said));
      // 留一眼确认听对了没有；这条笔记随后就显示在经文下面
      done(`已记下：${said.length > 18 ? `${said.slice(0, 18)}…` : said}`, 1400);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTranscribing(false);
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
                onClick={() => pickTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                  tab === t.key
                    ? 'border-brand-700 font-semibold text-brand-700'
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
              {godSpokeBox}
              <button className="btn-primary w-full py-3" onClick={saveText} disabled={busy}>
                {busy ? '保存中…' : editing ? '改好了' : '保存笔记'}
              </button>
              {editing && text.trim() && (
                <NoteReviewBlock
                  noteId={editing.id}
                  refLabel={ref}
                  disabled={text.trim() !== editing.content.trim() || busy}
                />
              )}
              {editing && text.trim() !== editing.content.trim() && (
                <p className="text-center text-[11px] text-muted">改完先点「改好了」，再请同行者点评</p>
              )}
              {editing && (
                <button
                  className="w-full py-2 text-sm text-accent active:opacity-60"
                  onClick={removeNote}
                  disabled={busy}
                >
                  删掉这条笔记
                </button>
              )}
            </div>
          )}

          {tab === 'audio' && (
            <div className="space-y-1">
              <Recorder
                autoStart
                busy={transcribing}
                onDone={speakToText}
                note={editing ? '说完点结束，接到这条笔记后面' : '说完点结束，转成文字直接记下，想改就点开这条笔记'}
              />
              {/* 口述说完就直接入库，不再经过"写下"，这个勾选得在开口前就够得着 */}
              <div className="px-1 pb-2">{godSpokeBox}</div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
