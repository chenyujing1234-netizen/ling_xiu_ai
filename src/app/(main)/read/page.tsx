import { redirect } from 'next/navigation';

/**
 * 读经已经并进灵修页的第一个页签，这里只负责把老链接和书签接过去。
 */
export default async function ReadRedirect({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; chapter?: string; devotion?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams({ tab: 'read' });
  if (sp.book) q.set('book', sp.book);
  if (sp.chapter) q.set('chapter', sp.chapter);
  if (sp.devotion) q.set('devotion', sp.devotion);
  redirect(`/devotion?${q}`);
}
