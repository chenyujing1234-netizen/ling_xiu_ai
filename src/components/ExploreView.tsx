'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import KnowledgeGraph, { type GraphData } from './KnowledgeGraph';
import Mindmap, { type MindmapNode } from './Mindmap';
import Waiting from './Waiting';
import RagSourcesFootnote from './RagSourcesFootnote';
import ImageStylePicker, { usePreferredImageStyle } from './ImageStylePicker';
import { useBackgroundJobs } from './BackgroundJobsProvider';
import { insightsAiLabel } from '@/lib/background-ai';
import type { RagSource } from '@/lib/rag-sources';

type Elements = {
  people: { name: string; role: string }[];
  times: { label: string; note: string }[];
  places: { name: string; note: string }[];
  plot: string[];
  climax: { verse: number; why: string };
  background: string;
  contemporary: { scripture: string[]; world: string[] };
  thesis: string | null;
  reflection: string[] | null;
};

type BookBrief = { id: number; name: string; chapters: number };
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

type Tab = 'elements' | 'graph' | 'mindmap' | 'image' | 'sermon';

const TABS: { key: Tab; label: string }[] = [
  { key: 'elements', label: '要素梳理' },
  { key: 'graph', label: '知识图谱' },
  { key: 'mindmap', label: '思维导图' },
  { key: 'image', label: '意境配图' },
  { key: 'sermon', label: '讲道视频' },
];

export default function ExploreView({
  books,
  initialBook,
  initialChapter,
}: {
  books: BookBrief[];
  initialBook: number;
  initialChapter: number;
}) {
  const [book, setBook] = useState(initialBook);
  const [chapter, setChapter] = useState(initialChapter);
  const [tab, setTab] = useState<Tab>('elements');

  const bookMeta = books.find((b) => b.id === book);
  const label = `${bookMeta?.name ?? ''}${chapter}章`;

  // 换章时把超出范围的章号收回来
  useEffect(() => {
    if (bookMeta && chapter > bookMeta.chapters) setChapter(1);
  }, [bookMeta, chapter]);

  // 记住上次浏览位置（下次进入「经文资料」自动恢复）
  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetch('/api/me/explore-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ bookId: book, chapter }),
        keepalive: true,
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [book, chapter]);

  return (
    <div>
      {/* top-11 让位给灵修页那层页签（h-11），否则两层吸顶会叠在一起 */}
      <header className="sticky top-11 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <h1 className="text-[17px] font-semibold">经文资料 · {label}</h1>
        <div className="mt-2 flex gap-2">
          <select
            className="field flex-1 py-2 text-sm"
            value={book}
            onChange={(e) => {
              setBook(Number(e.target.value));
              setChapter(1);
            }}
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="field w-24 py-2 text-sm"
            value={chapter}
            onChange={(e) => setChapter(Number(e.target.value))}
          >
            {Array.from({ length: bookMeta?.chapters ?? 1 }, (_, i) => i + 1).map((c) => (
              <option key={c} value={c}>
                {c} 章
              </option>
            ))}
          </select>
        </div>

        {/* 五个页签要在 390px 的窄屏上一排放下，不然"讲道视频"会被切掉半个，
            没人知道右边还能滑 */}
        <div className="mt-2 flex gap-1 overflow-x-auto no-bar">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-lg px-2 py-1.5 text-xs transition ${
                tab === t.key ? 'bg-brand-500 font-medium text-white' : 'border border-line text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-4">
        {tab === 'elements' && <ElementsPanel book={book} chapter={chapter} label={label} />}
        {tab === 'graph' && <GraphPanel book={book} chapter={chapter} label={label} />}
        {tab === 'mindmap' && <MindmapPanel book={book} chapter={chapter} label={label} />}
        {tab === 'image' && <ImagePanel book={book} chapter={chapter} label={label} />}
        {tab === 'sermon' && <SermonPanel book={book} chapter={chapter} />}
      </div>
    </div>
  );
}

// ---------- 通用的"按需生成"容器 ----------

function LazyPanel<T>({
  kind,
  book,
  chapter,
  actionLabel,
  hint,
  extraQuery = '',
  children,
}: {
  kind: string;
  book: number;
  chapter: number;
  actionLabel: string;
  hint: string;
  /** 追加到 insights 请求，例如 &style=watercolor */
  extraQuery?: string;
  children: (data: T, extra: { unlocked?: boolean; lockedHint?: string; ragSources?: RagSource[] }) => React.ReactNode;
}) {
  const { runJob } = useBackgroundJobs();
  const panelRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<T | null>(null);
  const [extra, setExtra] = useState<{ unlocked?: boolean; lockedHint?: string; ragSources?: RagSource[] }>({});
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    setBusy(true);
    const rect = panelRef.current?.getBoundingClientRect();
    const throwFrom = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : undefined;

    const { promise } = runJob({
      label: `${insightsAiLabel(kind)} · ${book}:${chapter}`,
      throwFrom,
      task: () =>
        api<{ data: T; unlocked?: boolean; lockedHint?: string; ragSources?: RagSource[] }>(
          `/api/insights?kind=${kind}&book=${book}&chapter=${chapter}${extraQuery}`,
        ),
      onSuccess: (res) => {
        setData(res.data);
        setExtra({ unlocked: res.unlocked, lockedHint: res.lockedHint, ragSources: res.ragSources });
      },
      onError: (err) => setError(err.message),
      present: () => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    });

    void promise.finally(() => setBusy(false));
  }, [kind, book, chapter, extraQuery, runJob]);

  /**
   * 生成过的内容要能复原。
   *
   * 切 tab 会让面板重新挂载、state 归零，之前生成的图看起来就"不见了"，
   * 其实一直缓存在服务端。这里进面板先只查缓存（cacheOnly，不会触发 AI），
   * 命中就直接显示。换经卷/章节时同样走这里，顺带清掉上一章的内容。
   */
  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    setProbing(true);
    api<{ data: T | null; unlocked?: boolean; lockedHint?: string; ragSources?: RagSource[] }>(
      `/api/insights?kind=${kind}&book=${book}&chapter=${chapter}&cacheOnly=1${extraQuery}`,
    )
      .then((res) => {
        if (!alive || !res.data) return;
        setData(res.data);
        setExtra({ unlocked: res.unlocked, lockedHint: res.lockedHint, ragSources: res.ragSources });
      })
      .catch(() => {
        /* 探测失败就当没缓存，照常显示生成按钮，不打扰用户 */
      })
      .finally(() => {
        if (alive) setProbing(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, book, chapter, extraQuery]);

  if (data) {
    return (
      <>
        {children(data, extra)}
        <RagSourcesFootnote sources={extra.ragSources} />
      </>
    );
  }

  if (probing) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
        载入中…
      </div>
    );
  }

  if (busy) {
    return (
      <div
        ref={panelRef}
        className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-5 py-8 text-center text-sm text-brand-800"
      >
        已在后台生成「{actionLabel.replace(/^生成/, '')}」，请看右上角红点袋；完成后会自动展示结果。
      </div>
    );
  }

  return (
    <div ref={panelRef} className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
      <p className="mb-4 text-sm leading-relaxed text-muted">{hint}</p>
      {error && <p className="mb-3 text-sm text-accent">{error}</p>}
      <button className="btn-primary" onClick={load}>
        {actionLabel}
      </button>
    </div>
  );
}

// ---------- 要素梳理 ----------

function ElementsPanel({ book, chapter, label }: { book: number; chapter: number; label: string }) {
  return (
    <LazyPanel<Elements>
      kind="elements"
      book={book}
      chapter={chapter}
      actionLabel="梳理这一章"
      hint="把这一章的人物、时间、地点、情节、高潮、时代背景和同期事件整理出来，帮你记住读过什么。"
    >
      {(el, extra) => (
        <div className="space-y-3">
          {el.people?.length > 0 && (
            <Card title="人物">
              <ul className="space-y-1.5">
                {el.people.map((p, i) => (
                  <li key={i} className="text-[14px] leading-relaxed">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted"> — {p.role}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {el.times?.length > 0 && (
            <Card title="时间">
              <ul className="space-y-1.5">
                {el.times.map((t, i) => (
                  <li key={i} className="text-[14px] leading-relaxed">
                    <span className="font-medium">{t.label}</span>
                    {t.note && <span className="text-muted"> — {t.note}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {el.places?.length > 0 && (
            <Card title="地点">
              <ul className="space-y-1.5">
                {el.places.map((p, i) => (
                  <li key={i} className="text-[14px] leading-relaxed">
                    <span className="font-medium">{p.name}</span>
                    {p.note && <span className="text-muted"> — {p.note}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {el.plot?.length > 0 && (
            <Card title="情节推进">
              <ol className="space-y-2">
                {el.plot.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] text-brand-700">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {el.climax?.why && (
            <Card title={`高潮转折${el.climax.verse ? ` · 第 ${el.climax.verse} 节` : ''}`}>
              <p className="text-[14px] leading-relaxed">{el.climax.why}</p>
            </Card>
          )}

          {el.background && (
            <Card title="时代背景">
              <p className="text-[14px] leading-relaxed">{el.background}</p>
            </Card>
          )}

          {(el.contemporary?.scripture?.length || el.contemporary?.world?.length) && (
            <Card title="同时期发生了什么">
              {el.contemporary.scripture?.length > 0 && (
                <>
                  <p className="label mb-1.5">圣经内</p>
                  <ul className="mb-3 space-y-1">
                    {el.contemporary.scripture.map((s, i) => (
                      <li key={i} className="text-[13.5px] leading-relaxed text-ink/90">· {s}</li>
                    ))}
                  </ul>
                </>
              )}
              {el.contemporary.world?.length > 0 && (
                <>
                  <p className="label mb-1.5">世界史 / 中国</p>
                  <ul className="space-y-1">
                    {el.contemporary.world.map((s, i) => (
                      <li key={i} className="text-[13.5px] leading-relaxed text-ink/90">· {s}</li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          {/* 要义与反思：未解锁则显示锁（R-D1） */}
          {el.thesis ? (
            <Card title="核心要义">
              <p className="text-[14.5px] leading-relaxed">{el.thesis}</p>
            </Card>
          ) : (
            <div className="card border-dashed px-4 py-5 text-center">
              <p className="mb-1 text-2xl">🔒</p>
              <p className="text-[13.5px] leading-relaxed text-muted">
                {extra.lockedHint ?? '核心要义需要你先自己思考后才揭晓'}
              </p>
              <Link href={`/devotion/start?book=${book}&chapter=${chapter}`} className="btn-ghost mt-3">
                开始灵修去解锁
              </Link>
            </div>
          )}

          {el.reflection && el.reflection.length > 0 && (
            <Card title="照见的现实">
              <ul className="space-y-1.5">
                {el.reflection.map((r, i) => (
                  <li key={i} className="text-[14px] leading-relaxed">· {r}</li>
                ))}
              </ul>
            </Card>
          )}

          <p className="pt-1 text-center text-xs text-muted">{label} · 结果已缓存，再看不额外消耗</p>
        </div>
      )}
    </LazyPanel>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card px-4 py-3.5">
      <p className="label mb-2">{title}</p>
      {children}
    </section>
  );
}

// ---------- 图谱 / 导图 / 配图 / 讲道 ----------

function GraphPanel({ book, chapter, label }: { book: number; chapter: number; label: string }) {
  return (
    <LazyPanel<GraphData>
      kind="graph"
      book={book}
      chapter={chapter}
      actionLabel="生成知识图谱"
      hint="把这一章的人物、地点、事件和主题的关系画成一张图，可以导出图片保存。"
    >
      {(data) => <KnowledgeGraph data={data} title={label} />}
    </LazyPanel>
  );
}

function MindmapPanel({ book, chapter, label }: { book: number; chapter: number; label: string }) {
  return (
    <LazyPanel<MindmapNode>
      kind="mindmap"
      book={book}
      chapter={chapter}
      actionLabel="生成思维导图"
      hint="把这一章的脉络整理成思维导图，一眼看清结构，可导出图片。"
    >
      {(data) => <Mindmap data={data} title={label} />}
    </LazyPanel>
  );
}

function ImagePanel({ book, chapter, label }: { book: number; chapter: number; label: string }) {
  const [style, setStyle] = usePreferredImageStyle();
  const styleQ = `&style=${encodeURIComponent(style)}`;

  return (
    <div className="space-y-4">
      <ImageStylePicker value={style} onChange={setStyle} />
      <LazyPanel<{ url: string | null }>
        key={style}
        kind="image"
        book={book}
        chapter={chapter}
        extraQuery={styleQ}
        actionLabel="生成意境配图"
        hint="根据这一章的场景与所选风格生成一张意境画面。生成需要较长时间，请耐心等待。"
      >
        {(data) =>
          data.url ? (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.url}
                alt={`${label} 意境配图`}
                width={1024}
                height={1024}
                decoding="async"
                className="aspect-square w-full rounded-2xl border border-line bg-line/30 object-cover"
              />
              <figcaption className="mt-2 text-center text-xs text-muted">
                {label} · AI 生成的意境画面，非历史考据插图
              </figcaption>
            </figure>
          ) : (
            <p className="card px-4 py-6 text-center text-sm text-muted">
              未配置文生图模型。在 .env.local 设置 AI_MODEL_IMAGE 后即可生成。
            </p>
          )
        }
      </LazyPanel>
    </div>
  );
}

function SermonPanel({ book, chapter }: { book: number; chapter: number }) {
  const [items, setItems] = useState<Resource[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setItems(null);
    api<{ resources: Resource[] }>(`/api/resources?book=${book}&chapter=${chapter}`)
      .then((r) => setItems(r.resources))
      .catch((e) => setError((e as Error).message));
  }, [book, chapter]);

  if (error) return <p className="text-sm text-accent">{error}</p>;
  if (!items) return <p className="py-10 text-center text-sm text-muted">加载中…</p>;

  if (!items.length) {
    return (
      <div className="card px-4 py-8 text-center">
        <p className="text-sm leading-relaxed text-muted">
          这一章还没有挂讲道资源。
          <br />
          管理员可以在后台添加福音影视网、B站等讲道链接，
          <br />
          并指定经文范围与视频起止时间。
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.id}>
          <a href={r.url} target="_blank" rel="noreferrer" className="card block px-4 py-3.5 active:bg-brand-50">
            <p className="text-[15px] font-medium">{r.title}</p>
            <p className="mt-0.5 text-xs text-muted">
              {[r.speaker, r.source].filter(Boolean).join(' · ')}
              {r.verse_start ? ` · ${r.verse_start}${r.verse_end && r.verse_end !== r.verse_start ? `-${r.verse_end}` : ''}节` : ''}
            </p>
            {r.note && <p className="mt-1 text-xs leading-relaxed text-muted">{r.note}</p>}
          </a>
        </li>
      ))}
    </ul>
  );
}
