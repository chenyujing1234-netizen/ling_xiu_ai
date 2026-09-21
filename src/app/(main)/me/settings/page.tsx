import { getSession } from '@/lib/auth';
import { allBooks, getSettings } from '@/lib/bible';
import SettingsForm from '@/components/SettingsForm';
import FontScalePicker from '@/components/FontScalePicker';
import ThemePicker from '@/components/ThemePicker';
import { normalizeFontScale } from '@/lib/font-scale';
import { normalizeTheme } from '@/lib/themes';

export default async function SettingsPage() {
  const session = await getSession();
  const [settings, bookList] = await Promise.all([getSettings(session!.uid), allBooks()]);
  const books = bookList.map((b) => ({ id: b.id, name: b.name_cn, chapters: b.chapters }));

  return (
    <div className="px-4 py-5">
      <h1 className="page-heading mb-1">读经与外观</h1>
      <p className="mb-5 text-sm font-medium text-muted">读经计划、字体大小、界面风格都可以在这里调整。</p>
      <div className="space-y-5">
      <FontScalePicker initial={normalizeFontScale(settings.font_scale)} />
      <ThemePicker initial={normalizeTheme(settings.theme)} />
      <SettingsForm
        books={books}
        initial={{
          dailyChapters: settings.daily_chapters,
          cursorBook: settings.cursor_book,
          cursorChapter: settings.cursor_chapter,
        }}
      />
      </div>
    </div>
  );
}
