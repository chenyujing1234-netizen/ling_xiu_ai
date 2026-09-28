/** 同一节经文的多条文字笔记合并为一条（展示与入库） */

export type VerseNoteLike = {
  id: number;
  verse: number;
  kind: string;
  content: string;
  media_path?: string | null;
  god_spoke?: number;
  created_at?: string;
  readerReviewed?: boolean;
};

const TEXT = 'text';

export function joinVerseNoteParts(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000);
}

/** 按节合并 text 笔记；其它 kind（如 audio）原样保留 */
export function consolidateVerseTextNotes<T extends VerseNoteLike>(notes: T[]): T[] {
  const passthrough: T[] = [];
  const byVerse = new Map<number, T[]>();

  for (const n of notes) {
    if (n.kind === TEXT && n.content?.trim()) {
      const list = byVerse.get(n.verse) ?? [];
      list.push(n);
      byVerse.set(n.verse, list);
    } else {
      passthrough.push(n);
    }
  }

  const merged: T[] = [...passthrough];
  for (const list of byVerse.values()) {
    if (list.length === 1) {
      merged.push(list[0]!);
      continue;
    }
    list.sort((a, b) => a.id - b.id);
    const primary = list[0]!;
    const content = joinVerseNoteParts(list.map((x) => x.content));
    const readerReviewed = list.some((x) => x.readerReviewed);
    merged.push({ ...primary, content, readerReviewed } as T);
  }

  merged.sort((a, b) => a.verse - b.verse || a.id - b.id);
  return merged;
}

type DbLike = {
  prepare: (sql: string) => {
    all: (...args: unknown[]) => Promise<{ id: number; verse: number; content: string }[]>;
    run: (...args: unknown[]) => Promise<{ changes?: number }>;
  };
};

/** 把库里同一节的多条 text 笔记收成一条（保留最早 id） */
export async function persistMergedTextNotesPerVerse(
  conn: DbLike,
  userId: number,
  bookId: number,
  chapter: number,
): Promise<void> {
  const rows = await conn
    .prepare(
      `SELECT id, verse, content FROM verse_notes
       WHERE user_id = ? AND book_id = ? AND chapter = ? AND kind = 'text'
       ORDER BY verse, id`,
    )
    .all(userId, bookId, chapter);

  const byVerse = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byVerse.get(r.verse) ?? [];
    list.push(r);
    byVerse.set(r.verse, list);
  }

  for (const list of byVerse.values()) {
    if (list.length <= 1) continue;
    const primary = list[0]!;
    const merged = joinVerseNoteParts(list.map((x) => x.content));
    await conn.prepare(`UPDATE verse_notes SET content = ? WHERE id = ? AND user_id = ?`).run(
      merged,
      primary.id,
      userId,
    );
    for (let i = 1; i < list.length; i++) {
      await conn.prepare(`DELETE FROM verse_notes WHERE id = ? AND user_id = ?`).run(
        list[i]!.id,
        userId,
      );
    }
  }
}
