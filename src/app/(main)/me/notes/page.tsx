import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

type Note = {
  id: number;
  book_id: number;
  book_name: string;
  chapter: number;
  verse: number;
  kind: string;
  content: string;
  media_path: string | null;
  god_spoke: number;
  created_at: string;
};

export default async function MyNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const onlySpoke = sp.filter === 'spoke';

  const notes = await db()
    .prepare(
      `SELECT n.id, n.book_id, b.name_cn AS book_name, n.chapter, n.verse, n.kind,
              n.content, n.media_path, n.god_spoke, n.created_at
       FROM verse_notes n JOIN bible_books b ON b.id = n.book_id
       WHERE n.user_id = ? ${onlySpoke ? 'AND n.god_spoke = 1' : ''}
       ORDER BY n.id DESC LIMIT 200`,
    )
    .all<Note>(session!.uid);

  return (
    <div className="px-4 py-5">
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold">我的读经笔记</h1>
        <div className="mt-3 flex gap-2">
          <Link
            href="/me/notes"
            className={`rounded-lg px-3 py-1.5 text-xs ${!onlySpoke ? 'bg-brand-500 text-white' : 'border border-line text-muted'}`}
          >
            全部
          </Link>
          <Link
            href="/me/notes?filter=spoke"
            className={`rounded-lg px-3 py-1.5 text-xs ${onlySpoke ? 'bg-brand-500 text-white' : 'border border-line text-muted'}`}
          >
            神对我说话
          </Link>
        </div>
      </header>

      {notes.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm leading-relaxed text-muted">
          还没有笔记。
          <br />
          在读经页长按任意一节，就能口述或写下想法。
        </p>
      ) : (
        <ul className="space-y-2.5">
          {notes.map((n) => (
            <li key={n.id} className="card px-4 py-3.5">
              <div className="mb-1.5 flex items-center justify-between">
                <Link
                  href={`/devotion?tab=read&book=${n.book_id}&chapter=${n.chapter}`}
                  className="text-xs font-medium text-brand-500"
                >
                  {n.book_name} {n.chapter}:{n.verse}
                </Link>
                <span className="text-[11px] text-muted">
                  {n.god_spoke ? '✦ 神对我说话 · ' : ''}
                  {n.created_at.slice(5, 16)}
                </span>
              </div>

              {n.content && <p className="text-[14px] leading-relaxed">{n.content}</p>}
              {n.kind === 'audio' && n.media_path && (
                <audio src={`/api/media/${n.media_path}`} controls className="mt-2 h-9 w-full" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
