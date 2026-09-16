import { getSession } from '@/lib/auth';
import { allBooks, getSettings } from '@/lib/bible';
import SettingsForm from '@/components/SettingsForm';

export default async function SettingsPage() {
  const session = await getSession();
  const settings = getSettings(session!.uid);
  const books = allBooks().map((b) => ({ id: b.id, name: b.name_cn, chapters: b.chapters }));

  return (
    <div className="px-4 py-5">
      <h1 className="mb-1 text-[22px] font-semibold">读经设置</h1>
      <p className="mb-5 text-sm text-muted">调整每天的读经量，或把进度挪到你想读的地方。</p>
      <SettingsForm
        books={books}
        initial={{
          dailyChapters: settings.daily_chapters,
          cursorBook: settings.cursor_book,
          cursorChapter: settings.cursor_chapter,
        }}
      />
    </div>
  );
}
