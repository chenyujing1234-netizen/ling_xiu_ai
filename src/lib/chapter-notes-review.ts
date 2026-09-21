import { db } from './db';
import { getBook, getChapter } from './bible';
import { chat, MODELS, aiConfigured } from './ai';
import { COACH_PERSONA, chapterNotesSummaryPrompt } from './prompts';
import { fallbackChapterNotesReview } from './fallback';
import { bad } from './api';
import { knowledgeForLlm } from './knowledge-context';
import { noteContentHash } from './note-review';
import { parseRagSources, serializeRagSources, type RagSource } from './rag-sources';

export type ChapterNoteRow = {
  id: number;
  verse: number;
  content: string;
  god_spoke: number;
};

const CHAPTER_REVIEW_MAX_CHARS = 220;

export function clampChapterReviewLength(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const chars = [...t];
  if (chars.length <= CHAPTER_REVIEW_MAX_CHARS) return t;
  return chars.slice(0, CHAPTER_REVIEW_MAX_CHARS).join('').replace(/[，。；、：]$/, '') + '…';
}

/** 本章所有文字笔记的指纹（节序 + 内容变则重评） */
export function chapterNotesFingerprint(notes: ChapterNoteRow[]): string {
  const payload = notes
    .filter((n) => n.content?.trim())
    .sort((a, b) => a.verse - b.verse || a.id - b.id)
    .map((n) => `${n.verse}|${n.god_spoke}|${n.content.trim()}`)
    .join('\n');
  return noteContentHash(payload || 'empty');
}

export function chapterReviewIsCurrent(
  cached: { content_hash: string; review: string } | null | undefined,
  notes: ChapterNoteRow[],
): boolean {
  if (!cached?.review?.trim()) return false;
  return cached.content_hash === chapterNotesFingerprint(notes);
}

async function getCachedChapterReview(userId: number, bookId: number, chapter: number) {
  return db()
    .prepare(
      `SELECT content_hash, review, rag_sources FROM chapter_note_reviews
       WHERE user_id = ? AND book_id = ? AND chapter = ?`,
    )
    .get<{ content_hash: string; review: string; rag_sources: string | null }>(userId, bookId, chapter);
}

async function saveChapterReview(
  userId: number,
  bookId: number,
  chapter: number,
  hash: string,
  review: string,
  ragSources: RagSource[] | undefined,
) {
  await db()
    .prepare(
      `INSERT INTO chapter_note_reviews (user_id, book_id, chapter, content_hash, review, rag_sources)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         content_hash = VALUES(content_hash),
         review = VALUES(review),
         rag_sources = VALUES(rag_sources),
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(userId, bookId, chapter, hash, review, serializeRagSources(ragSources));
}

async function loadChapterTextNotes(userId: number, bookId: number, chapter: number): Promise<ChapterNoteRow[]> {
  return db()
    .prepare(
      `SELECT id, verse, content, god_spoke FROM verse_notes
       WHERE user_id = ? AND book_id = ? AND chapter = ? AND TRIM(content) <> ''
       ORDER BY verse, id`,
    )
    .all<ChapterNoteRow>(userId, bookId, chapter);
}

export async function reviewChapterNotes(
  userId: number,
  bookId: number,
  chapter: number,
  opts?: { cacheOnly?: boolean },
): Promise<{ review: string | null; cached: boolean; ragSources: RagSource[]; noteCount: number }> {
  const book = await getBook(bookId);
  if (!book) bad('没有这卷书');
  if (chapter < 1 || chapter > book.chapters) bad('章数不对');

  const notes = await loadChapterTextNotes(userId, bookId, chapter);
  if (!notes.length) bad('本章还没有文字笔记，长按经节写下后再试');

  const hash = chapterNotesFingerprint(notes);
  const cached = await getCachedChapterReview(userId, bookId, chapter);
  if (cached?.content_hash === hash && cached.review.trim()) {
    return {
      review: clampChapterReviewLength(cached.review),
      cached: true,
      ragSources: parseRagSources(cached.rag_sources),
      noteCount: notes.length,
    };
  }
  if (opts?.cacheOnly) {
    return { review: null, cached: false, ragSources: [], noteCount: notes.length };
  }

  const verses = await getChapter(bookId, chapter);
  const passage = verses.map((v) => `${v.verse} ${v.cn}`).join('\n');
  const ref = `${book.name_cn} ${chapter}章`;
  const notesBlock = notes
    .map((n) => {
      const spoke = n.god_spoke ? ' · 标记「神对我说话」' : '';
      return `${n.verse}节${spoke}：${n.content.trim()}`;
    })
    .join('\n');
  const focus = notes.map((n) => n.content).join('\n');

  let review: string;
  let ragSources: RagSource[] = [];
  try {
    if (!aiConfigured()) throw new Error('AI 未配置');
    const ctx = await knowledgeForLlm({
      ref: `${ref}（本章）`,
      bookName: book.name_cn,
      passage,
      focus,
    });
    ragSources = ctx.ragSources;
    review = await chat(
      [
        { role: 'system', content: COACH_PERSONA },
        {
          role: 'user',
          content: chapterNotesSummaryPrompt({
            ref,
            passage,
            notesBlock,
            knowledge: ctx.knowledge,
          }),
        },
      ],
      { model: MODELS.fast(), maxTokens: 480, temperature: 0.68 },
    );
  } catch (err) {
    console.warn(`[ai:degraded] 本章笔记总结: ${(err as Error)?.message ?? String(err)}`);
    review = fallbackChapterNotesReview(ref, notes.length);
    ragSources = [];
  }

  const trimmed = clampChapterReviewLength(review.trim());
  if (trimmed) {
    await saveChapterReview(userId, bookId, chapter, hash, trimmed, ragSources);
  }
  return { review: trimmed || null, cached: false, ragSources, noteCount: notes.length };
}

/**  devotion 接口用：是否已有与当前笔记集匹配的总结 */
export async function chapterNotesReviewStatus(
  userId: number,
  bookId: number,
  chapter: number,
  notes: ChapterNoteRow[],
): Promise<boolean> {
  const withText = notes.filter((n) => n.content?.trim());
  if (!withText.length) return false;
  const cached = await getCachedChapterReview(userId, bookId, chapter);
  return chapterReviewIsCurrent(cached, withText);
}
