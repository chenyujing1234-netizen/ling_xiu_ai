import { handler, intParam, notFound } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { contextWindow, getVerse, refLabel } from '@/lib/bible';

// R-B4：返回该节前 10 节与后 10 节的原文（不含 AI 分析，AI 分析走 /api/insights/context）
export async function GET(req: Request) {
  return handler(async () => {
    await requireSession();
    const bookId = intParam(req, 'book');
    const chapter = intParam(req, 'chapter');
    const verse = intParam(req, 'verse');

    const target = getVerse(bookId, chapter, verse);
    if (!target) notFound('没有这一节');

    const { before, after } = contextWindow(bookId, chapter, verse, 10);
    return { ref: refLabel(bookId, chapter, verse), target, before, after };
  });
}
