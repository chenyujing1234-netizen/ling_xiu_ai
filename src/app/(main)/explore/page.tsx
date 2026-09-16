import ExploreView from '@/components/ExploreView';
import { getSession } from '@/lib/auth';
import { allBooks, getSettings } from '@/lib/bible';

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; chapter?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const settings = getSettings(session!.uid);
  const books = allBooks().map((b) => ({ id: b.id, name: b.name_cn, chapters: b.chapters }));

  return (
    <ExploreView
      books={books}
      initialBook={Number(sp.book) || settings.cursor_book}
      initialChapter={Number(sp.chapter) || settings.cursor_chapter}
    />
  );
}
