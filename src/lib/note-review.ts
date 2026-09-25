import { createHash } from 'crypto';
import { db } from './db';
import { getVerse } from './bible';
import { chat, MODELS, aiConfigured } from './ai';
import { COACH_PERSONA, noteReviewPrompt } from './prompts';
import { fallbackNoteReview } from './fallback';
import { HttpError } from './auth';
import { bad } from './api';
import { knowledgeForLlm } from './knowledge-context';
import { parseRagSources, serializeRagSources, type RagSource } from './rag-sources';

type NoteRow = {
  id: number;
  user_id: number;
  book_id: number;
  chapter: number;
  verse: number;
  content: string;
  god_spoke: number;
  book_name: string;
};

const NOTE_REVIEW_MAX_CHARS = 200;

/** 笔记点评硬性上限（汉字按码点计） */
export function clampNoteReviewLength(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const chars = [...t];
  if (chars.length <= NOTE_REVIEW_MAX_CHARS) return t;
  return chars.slice(0, NOTE_REVIEW_MAX_CHARS).join('').replace(/[，。；、：]$/, '') + '…';
}

export function noteContentHash(content: string): string {
  return createHash('sha256').update(content.trim()).digest('hex');
}

function contentHash(content: string): string {
  return noteContentHash(content);
}

export function noteReviewIsCurrent(
  cached: { content_hash: string; review: string } | null | undefined,
  content: string,
): boolean {
  if (!cached?.review?.trim()) return false;
  return cached.content_hash === noteContentHash(content);
}

/** 批量标注笔记是否已有与当前正文匹配的陪读者点评 */
export async function attachNoteReviewFlags<T extends { id: number; content: string }>(
  notes: T[],
): Promise<(T & { readerReviewed: boolean })[]> {
  if (notes.length === 0) return [];
  const placeholders = notes.map(() => '?').join(',');
  const rows = await db()
    .prepare(
      `SELECT note_id, content_hash, review FROM verse_note_reviews WHERE note_id IN (${placeholders})`,
    )
    .all(...notes.map((n) => n.id));
  const map = new Map(
    (rows as { note_id: number; content_hash: string; review: string }[]).map((r) => [r.note_id, r]),
  );
  return notes.map((n) => ({
    ...n,
    readerReviewed: noteReviewIsCurrent(map.get(n.id), n.content),
  }));
}

export async function getCachedNoteReview(
  noteId: number,
): Promise<{ content_hash: string; review: string; rag_sources: string | null } | null> {
  const row = await db()
    .prepare(`SELECT content_hash, review, rag_sources FROM verse_note_reviews WHERE note_id = ?`)
    .get<{ content_hash: string; review: string; rag_sources: string | null }>(noteId);
  return row ?? null;
}

async function saveNoteReview(
  noteId: number,
  hash: string,
  review: string,
  ragSources: RagSource[] | undefined,
) {
  const ragJson = serializeRagSources(ragSources);
  await db()
    .prepare(
      `INSERT INTO verse_note_reviews (note_id, content_hash, review, rag_sources)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         content_hash = VALUES(content_hash),
         review = VALUES(review),
         rag_sources = VALUES(rag_sources),
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(noteId, hash, review, ragJson);
}

async function loadNote(noteId: number, userId: number): Promise<NoteRow> {
  const row = await db()
    .prepare(
      `SELECT n.id, n.user_id, n.book_id, n.chapter, n.verse, n.content, n.god_spoke,
              b.name_cn AS book_name
       FROM verse_notes n JOIN bible_books b ON b.id = n.book_id
       WHERE n.id = ? AND n.user_id = ?`,
    )
    .get<NoteRow>(noteId, userId);
  if (!row) throw new HttpError(404, '笔记不存在');
  return row;
}

/** 生成或返回缓存的笔记点评；cacheOnly 时仅命中缓存，不调用 LLM */
export async function reviewVerseNote(
  noteId: number,
  userId: number,
  opts?: { cacheOnly?: boolean },
): Promise<{ review: string | null; cached: boolean; ragSources: RagSource[] }> {
  const note = await loadNote(noteId, userId);
  const text = (note.content ?? '').trim();
  if (!text) bad('请先写一点文字，陪读者才好点评');

  const hash = contentHash(text);
  const cached = await getCachedNoteReview(noteId);
  if (cached?.content_hash === hash && cached.review.trim()) {
    return {
      review: clampNoteReviewLength(cached.review),
      cached: true,
      ragSources: parseRagSources(cached.rag_sources),
    };
  }
  if (opts?.cacheOnly) {
    return { review: null, cached: false, ragSources: [] };
  }

  const ref = `${note.book_name} ${note.chapter}:${note.verse}`;
  const verse = await getVerse(note.book_id, note.chapter, note.verse);
  const verseText = verse?.cn?.trim() || '（经文正文暂未载入）';

  let review: string;
  let ragSources: RagSource[] = [];
  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    const ctx = await knowledgeForLlm({
      ref,
      bookName: note.book_name,
      passage: verseText,
      focus: text,
    });
    ragSources = ctx.ragSources;
    review = await chat(
      [
        { role: 'system', content: COACH_PERSONA },
        {
          role: 'user',
          content: noteReviewPrompt({
            ref,
            verseText,
            noteContent: text,
            knowledge: ctx.knowledge,
          }),
        },
      ],
      { model: MODELS.fast(), maxTokens: 480, temperature: 0.65 },
    );
  } catch (err) {
    console.warn(`[ai:degraded] 笔记点评: ${(err as Error)?.message ?? String(err)}`);
    review = fallbackNoteReview(ref, text);
    ragSources = [];
  }

  const trimmed = clampNoteReviewLength(review.trim());
  if (trimmed) {
    await saveNoteReview(noteId, hash, trimmed, ragSources);
  }
  return { review: trimmed || null, cached: false, ragSources };
}
