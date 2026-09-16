import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getOrCreateDevotion } from '@/lib/devotion';
import { getSettings } from '@/lib/bible';

/** 中转页：按经文范围创建（或找回）灵修会话，然后跳到流程页 */
export default async function StartDevotionPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; chapter?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const settings = getSettings(session!.uid);

  const bookId = Number(sp.book) || settings.cursor_book;
  const chapter = Number(sp.chapter) || settings.cursor_chapter;
  const d = getOrCreateDevotion(session!.uid, bookId, chapter, Number(sp.from) || 1, Number(sp.to) || 0);

  redirect(`/devotion/${d.id}`);
}
