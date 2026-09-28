/** 从后台任务 label 解析经文出处（用于结果页展示正文） */

export type ParsedJobScriptureRef = {
  bookId?: number;
  bookName?: string;
  chapter: number;
  /** 单节或起止节；缺省表示整章（如 explore 的 bookId:chapter） */
  from?: number;
  to?: number;
};

/**
 * 例：
 * - `配图 创世记 1:1` / `背景 马太福音 5:3-7`
 * - `笔记点评 约翰福音 3:16`
 * - `要素梳理 · 40:3`（bookId + 章）
 * - `本章笔记总结 创世记 3章`
 */
export function parseScriptureRefFromJobLabel(label: string): ParsedJobScriptureRef | null {
  const s = label.trim();
  if (!s) return null;

  const namedVerse = s.match(
    /([\u4e00-\u9fff《》·]+?)\s+(\d{1,3})\s*[：:]\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?/,
  );
  if (namedVerse) {
    const bookName = namedVerse[1]!.replace(/^[·•\s]+/, '').trim();
    const chapter = Number(namedVerse[2]);
    const from = Number(namedVerse[3]);
    const to = namedVerse[4] ? Number(namedVerse[4]) : from;
    if (bookName && chapter > 0 && from > 0) {
      return { bookName, chapter, from, to };
    }
  }

  const namedChapter = s.match(/([\u4e00-\u9fff《》·]+?)\s+(\d{1,3})\s*章/);
  if (namedChapter) {
    const bookName = namedChapter[1]!.replace(/^[·•\s]+/, '').trim();
    const chapter = Number(namedChapter[2]);
    if (bookName && chapter > 0) return { bookName, chapter };
  }

  const numericChapter = s.match(/[·•]\s*(\d{1,2})\s*[：:]\s*(\d{1,3})\s*$/);
  if (numericChapter) {
    const bookId = Number(numericChapter[1]);
    const chapter = Number(numericChapter[2]);
    if (bookId > 0 && chapter > 0) return { bookId, chapter };
  }

  return null;
}
