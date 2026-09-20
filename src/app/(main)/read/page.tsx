import { redirect } from 'next/navigation';

/** 读经页已移除；老链接接到灵修流程或灵修列表。 */
export default async function ReadRedirect({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; chapter?: string; devotion?: string }>;
}) {
  const sp = await searchParams;
  if (sp.devotion) redirect(`/devotion/${sp.devotion}`);
  const q = new URLSearchParams();
  if (sp.book) q.set('book', sp.book);
  if (sp.chapter) q.set('chapter', sp.chapter);
  redirect(sp.book && sp.chapter ? `/devotion/start?${q}` : '/devotion');
}
