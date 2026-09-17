import Reader from '@/components/Reader';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/bible';

export default async function ReadPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; chapter?: string; devotion?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const settings = await getSettings(session!.uid);

  // 没带参数就从他自己的读经游标开始
  const book = Number(sp.book) || settings.cursor_book;
  const chapter = Number(sp.chapter) || settings.cursor_chapter;

  return (
    <Reader
      initialBook={book}
      initialChapter={chapter}
      devotionId={sp.devotion ? Number(sp.devotion) : null}
    />
  );
}
