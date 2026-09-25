'use client';

import Link from 'next/link';
import { NoteReviewedBadge } from '@/components/Ui';
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
  readerReviewed?: boolean;
};

export default function NotesList({ notes }: { notes: NoteItem[] }) {
  return (
    <ul className="space-y-2.5">
      {notes.map((n) => {
        const refLabel = `${n.book_name} ${n.chapter}:${n.verse}`;
        return (
          <li key={n.id} className="card px-4 py-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <Link
                  href={`/devotion/start?book=${n.book_id}&chapter=${n.chapter}`}
                  className="btn-ghost inline-flex px-2.5 py-1 text-xs"
                >
                  {refLabel}
                </Link>
                {n.readerReviewed && n.content?.trim() && <NoteReviewedBadge />}
              </div>
              <span className="text-[11px] text-muted">{n.created_at.slice(5, 16)}</span>
            </div>

            {n.content && <p className="text-[14px] leading-relaxed">{n.content}</p>}
            {n.content?.trim() && (
              <NoteReviewBlock noteId={n.id} refLabel={refLabel} readerReviewed={n.readerReviewed} />
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
