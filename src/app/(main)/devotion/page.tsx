import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { allBooks, explorePosition, getSettings, refLabel } from '@/lib/bible';
import { db } from '@/lib/db';
import { STAGE_META, type Stage } from '@/lib/devotion';
import DevotionHome, { type HomeTab } from '@/components/DevotionHome';
import ExploreView from '@/components/ExploreView';
import { IconCheck, IconFlame, IconPlay, SectionTitle } from '@/components/Ui';

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
  searchParams: Promise<{ tab?: string; book?: string; chapter?: string; devotion?: string }>;
}) {
  const sp = await searchParams;
  if (sp.tab === 'read') {
    if (sp.devotion) redirect(`/devotion/${sp.devotion}`);
    const q = new URLSearchParams();
    if (sp.book) q.set('book', sp.book);
    if (sp.chapter) q.set('chapter', sp.chapter);
    redirect(sp.book && sp.chapter ? `/devotion/start?${q}` : '/devotion');
  }
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

  const tab: HomeTab = sp.tab === 'explore' ? 'explore' : 'devotion';
  const savedExplore = explorePosition(settings);
  const book = Number(sp.book) || savedExplore.book;
  const chapter = Number(sp.chapter) || savedExplore.chapter;

  return (
    <DevotionHome initialTab={tab} explore={<ExploreView books={books} initialBook={book} initialChapter={chapter} />}>
      <div className="px-4 py-5">
      {/* 页签上已经写着"我的灵修"，标题只留给读屏软件，不再占一行 */}
      <header className="mb-5">
        <h1 className="sr-only">我的灵修</h1>
        <p className="text-sm leading-relaxed text-muted">
          七步走完才算一次完整的灵修：观察 → 提问 → 默想 → 引导 → 实事 → 祷告。
        </p>
      </header>

      <Link
        href={`/devotion/start?book=${settings.cursor_book}&chapter=${settings.cursor_chapter}`}
        className="btn-primary w-full gap-2 py-3"
      >
        <IconPlay size={18} />
        就 {startLabel} 开始灵修
      </Link>

      {ongoing.length > 0 && (
        <section className="mt-6">
          <SectionTitle icon={<IconFlame size={16} />}>进行中</SectionTitle>
          <ul className="space-y-2">
            {ongoing.map((r) => (
              <li key={r.id}>
                <Link href={`/devotion/${r.id}`} className="card block px-4 py-3.5 active:bg-brand-50">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] font-bold">
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
        <SectionTitle icon={<IconCheck size={16} />}>已完成（{finished.length}）</SectionTitle>
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
                    <span className="text-[15px] font-bold">
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
