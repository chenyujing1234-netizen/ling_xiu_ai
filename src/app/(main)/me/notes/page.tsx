import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import NotesList, { type NoteItem } from '@/components/NotesList';
import { attachNoteReviewFlags } from '@/lib/note-review';

export default async function MyNotesPage() {
  const session = await getSession();

  const rawNotes = await db()
    .prepare(
      `SELECT n.id, n.book_id, b.name_cn AS book_name, n.chapter, n.verse, n.kind,
              n.content, n.media_path, n.god_spoke, n.created_at
       FROM verse_notes n JOIN bible_books b ON b.id = n.book_id
       WHERE n.user_id = ?
       ORDER BY n.id DESC LIMIT 200`,
    )
    .all<Omit<NoteItem, 'readerReviewed'>>(session!.uid);

  const notes = await attachNoteReviewFlags(rawNotes);

  return (
    <div className="px-4 py-5">
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold">我的读经笔记</h1>
      </header>

      {notes.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm leading-relaxed text-muted">
          还没有笔记。
          <br />
          在灵修流程的经文里长按任意一节，就能口述或写下想法。
        </p>
      ) : (
        <NotesList notes={notes} />
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
