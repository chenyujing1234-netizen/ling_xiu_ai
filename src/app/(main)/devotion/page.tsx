import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { allBooks, getSettings, refLabel } from '@/lib/bible';
import { db } from '@/lib/db';
import { STAGE_META, type Stage } from '@/lib/devotion';
import DevotionHome from '@/components/DevotionHome';
import ExploreView from '@/components/ExploreView';

type Row = {
  id: number;
  day: string;
  book_id: number;
  book_name: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  stage: Stage;
  score: number;
  unlocked: number;
  completed_at: string | null;
  input_count: number;
};

export default async function DevotionListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; book?: string; chapter?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const [settings, bookList, rows] = await Promise.all([
    getSettings(session!.uid),
    allBooks(),
    db()
      .prepare(
        `SELECT d.id, d.day, d.book_id, b.name_cn AS book_name, d.chapter, d.verse_start, d.verse_end,
                d.stage, d.score, d.unlocked, d.completed_at,
                (SELECT COUNT(*) FROM devotion_inputs i WHERE i.devotion_id = d.id) AS input_count
         FROM devotions d JOIN bible_books b ON b.id = d.book_id
         WHERE d.user_id = ? ORDER BY d.id DESC LIMIT 60`,
      )
      .all<Row>(session!.uid),
  ]);
  const books = bookList.map((b) => ({ id: b.id, name: b.name_cn, chapters: b.chapters }));
  const startLabel = await refLabel(settings.cursor_book, settings.cursor_chapter);

  const ongoing = rows.filter((r) => r.stage !== 'done');
  const finished = rows.filter((r) => r.stage === 'done');

  return (
    <DevotionHome
      initialTab={sp.tab === 'explore' ? 'explore' : 'devotion'}
      explore={
        <ExploreView
          books={books}
          initialBook={Number(sp.book) || settings.cursor_book}
          initialChapter={Number(sp.chapter) || settings.cursor_chapter}
        />
      }
    >
      <div className="px-4 py-5">
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold">灵修</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          七步走完才算一次完整的灵修：观察 → 提问 → 默想 → 引导 → 实事 → 祷告。
        </p>
      </header>

      <Link
        href={`/devotion/start?book=${settings.cursor_book}&chapter=${settings.cursor_chapter}`}
        className="btn-primary w-full py-3"
      >
        就 {startLabel} 开始灵修
      </Link>

      {ongoing.length > 0 && (
        <section className="mt-6">
          <h2 className="label mb-2">进行中</h2>
          <ul className="space-y-2">
            {ongoing.map((r) => (
              <li key={r.id}>
                <Link href={`/devotion/${r.id}`} className="card block px-4 py-3.5 active:bg-brand-50">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] font-medium">
                      {r.book_name} {r.chapter}章
                    </span>
                    <span className="chip">{STAGE_META[r.stage]?.title ?? r.stage}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {r.day} · 已写 {r.input_count} 条
                    {r.score ? ` · 评估 ${r.score} 分` : ''}
                    {r.unlocked ? ' · 已解锁引导' : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="label mb-2">已完成（{finished.length}）</h2>
        {finished.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm leading-relaxed text-muted">
            还没有完成的灵修。
            <br />
            翻完页不算读过 —— 有观察、有提问、有回应才算。
          </p>
        ) : (
          <ul className="space-y-2">
            {finished.map((r) => (
              <li key={r.id}>
                <Link href={`/devotion/${r.id}`} className="card block px-4 py-3.5 active:bg-brand-50">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] font-medium">
                      {r.book_name} {r.chapter}章
                    </span>
                    <span className="text-xs text-brand-500">{r.score} 分</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {r.completed_at?.slice(0, 16) ?? r.day} · {r.input_count} 条记录
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </DevotionHome>
  );
}
