import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSettings, planFrom } from '@/lib/bible';
import { summaryOf, chapterStatus } from '@/lib/stats';
import { db } from '@/lib/db';
import { STAGE_META, type Stage } from '@/lib/devotion';
import { getResumePath } from '@/lib/resume';
import PageBanner from '@/components/PageBanner';
import ThemePickerButton from '@/components/ThemePickerButton';
import {
  IconBook,
  IconCheck,
  IconChevronRight,
  IconFlame,
  IconNotes,
  IconPlay,
  IconSpark,
  IconStreak,
  SectionTitle,
} from '@/components/Ui';
import { normalizeTheme } from '@/lib/themes';

type TodaySearch = { home?: string };

export default async function TodayPage({ searchParams }: { searchParams: Promise<TodaySearch> }) {
  const session = await getSession();
  const uid = session!.uid;
  const sp = await searchParams;
  const forceToday = sp.home === '1';
  if (!forceToday) {
    const resume = await getResumePath(uid);
    if (resume && resume !== '/') redirect(resume);
  }
  const [settings, summary, ongoing] = await Promise.all([
    getSettings(uid),
    summaryOf(uid),
    // 进行中的灵修，方便一键接着做
    db()
      .prepare(
        `SELECT d.id, b.name_cn AS book_name, d.chapter, d.stage FROM devotions d
         JOIN bible_books b ON b.id = d.book_id
         WHERE d.user_id = ? AND d.stage <> 'done' ORDER BY d.updated_at DESC LIMIT 3`,
      )
      .all<{ id: number; book_name: string; chapter: number; stage: Stage }>(uid),
  ]);

  const plan = await planFrom(settings.cursor_book, settings.cursor_chapter, settings.daily_chapters);
  const status = await chapterStatus(uid, plan);
  const doneCount = status.filter((s) => s.engaged).length;

  const hour = new Date().getHours();
  const greeting = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '午安' : hour < 19 ? '下午好' : '晚上好';

  return (
    <div className="px-4 py-5">
      <PageBanner variant="today" priority />
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            {greeting}，{session!.name}
          </p>
          <h1 className="page-heading mt-1">
            {doneCount === 0
              ? '今天还没有开始'
              : doneCount >= plan.length
                ? '今天的读经完成了'
                : `今天完成了 ${doneCount} / ${plan.length} 章`}
          </h1>
        </div>
        <ThemePickerButton initial={normalizeTheme(settings.theme)} />
      </header>

      {/* 统计条 */}
      <section className="card card-highlight mb-5 grid grid-cols-3 divide-x divide-brand-200/60 px-2 py-3.5">
        {[
          { value: summary.streak, unit: '天', label: '连续读经', icon: IconStreak },
          { value: summary.totalDevotions, unit: '次', label: '完整灵修', icon: IconFlame },
          { value: summary.totalNotes, unit: '条', label: '读经笔记', icon: IconNotes },
        ].map((s) => (
          <div key={s.label} className="px-2 text-center">
            <s.icon className="mx-auto mb-1 text-brand-500" size={18} />
            <p className="text-[22px] font-bold leading-none text-brand-500">
              {s.value}
              <span className="ml-0.5 text-xs font-semibold text-muted">{s.unit}</span>
            </p>
            <p className="mt-1.5 text-[11px] font-semibold text-muted">{s.label}</p>
          </div>
        ))}
      </section>

      {/* 今日读经计划 */}
      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionTitle icon={<IconBook size={16} />}>今日读经 · {settings.daily_chapters} 章</SectionTitle>
          <Link href="/me/settings" className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-brand-600">
            调整
          </Link>
        </div>
        <ul className="space-y-2">
          {status.map((s) => (
            <li key={`${s.bookId}-${s.chapter}`} className="card flex items-center gap-3 px-4 py-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                  s.engaged
                    ? 'bg-brand-500 text-white'
                    : s.opened
                      ? 'bg-brand-100 text-brand-700'
                      : 'border border-line text-muted'
                }`}
              >
                {s.engaged ? <IconCheck className="text-white" size={14} /> : s.chapter}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">
                  {s.name} {s.chapter}章
                </p>
                <p className="text-[11px] text-muted">
                  {s.engaged
                    ? '已读过（有互动）'
                    : s.devotionStage
                      ? `灵修进行中 · ${STAGE_META[s.devotionStage as Stage]?.title ?? ''}`
                      : s.opened
                        ? '打开过，但还没有互动'
                        : '未开始'}
                </p>
              </div>
              <Link
                href={`/devotion/start?book=${s.bookId}&chapter=${s.chapter}`}
                className="btn-ghost shrink-0 gap-1 px-3 py-1.5 text-xs"
              >
                <IconPlay size={14} />
                {s.opened ? '继续' : '灵修'}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {ongoing.length > 0 && (
        <section className="mb-5">
          <SectionTitle icon={<IconFlame size={16} />}>接着做</SectionTitle>
          <ul className="space-y-2">
            {ongoing.map((o) => (
              <li key={o.id}>
                <Link href={`/devotion/${o.id}`} className="card flex items-center justify-between gap-2 px-4 py-3 active:bg-brand-50">
                  <span className="text-[15px] font-bold">
                    {o.book_name} {o.chapter}章
                  </span>
                  <span className="chip">{STAGE_META[o.stage]?.title ?? o.stage}</span>
                  <IconChevronRight className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 提醒产品的核心主张 */}
      <section className="card card-highlight px-4 py-4">
        <div className="flex gap-2">
          <IconSpark className="mt-0.5 shrink-0 text-brand-500" size={22} />
          <p className="text-[13.5px] font-medium leading-[1.9] text-brand-700">
            <span className="font-bold">翻完页不算读过。</span>
            <br />
            先自己观察、自己提问、自己想过，
            <br />
            引导才会为你开启 —— 因为现在就给你答案，
            <br />
            会把你自己能发现的那一份夺走。
          </p>
        </div>
        <Link
          href={`/devotion/start?book=${settings.cursor_book}&chapter=${settings.cursor_chapter}`}
          className="btn-primary mt-3.5 w-full gap-2 py-2.5"
        >
          <IconFlame size={18} />
          开始今天的灵修
        </Link>
      </section>

      {summary.godSpokeCount > 0 && (
        <p className="mt-4 text-center text-xs text-muted">
          你已标记 {summary.godSpokeCount} 处「神对我说话」·{' '}
          <Link href="/me/notes" className="text-brand-500">
            回看
          </Link>
        </p>
      )}
    </div>
  );
}

// 让首页始终反映最新进度，不要被静态化缓存
export const dynamic = 'force-dynamic';
