import { redirect } from 'next/navigation';

/**
 * "发现"已并入"灵修"。旧地址仍留着做跳转：
 * 之前发出去的链接和存过的书签不该变成 404。
 */
export default async function ExploreRedirect({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; chapter?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams({ tab: 'explore' });
  if (sp.book) q.set('book', sp.book);
  if (sp.chapter) q.set('chapter', sp.chapter);
  redirect(`/devotion?${q}`);
}
