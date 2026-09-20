'use client';

import Link from 'next/link';
import NoteReviewBlock from './NoteReviewBlock';

export type NoteItem = {
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

export default function NotesList({ notes }: { notes: NoteItem[] }) {
  return (
    <ul className="space-y-2.5">
      {notes.map((n) => {
        const refLabel = `${n.book_name} ${n.chapter}:${n.verse}`;
        return (
          <li key={n.id} className="card px-4 py-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <Link
                href={`/devotion/start?book=${n.book_id}&chapter=${n.chapter}`}
                className="text-xs font-medium text-brand-500"
              >
                {refLabel}
              </Link>
              <span className="text-[11px] text-muted">
                {n.god_spoke ? '✦ 神对我说话 · ' : ''}
                {n.created_at.slice(5, 16)}
              </span>
            </div>

            {n.content && <p className="text-[14px] leading-relaxed">{n.content}</p>}
            {n.content?.trim() && (
              <NoteReviewBlock noteId={n.id} refLabel={refLabel} />
            )}
            {n.kind === 'audio' && n.media_path && (
              <audio src={`/api/media/${n.media_path}`} controls className="mt-2 h-9 w-full" />
            )}
          </li>
        );
      })}
    </ul>
  );
}
