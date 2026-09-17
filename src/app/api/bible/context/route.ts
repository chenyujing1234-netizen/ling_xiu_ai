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

    const [target, { before, after }, ref] = await Promise.all([
      getVerse(bookId, chapter, verse),
      contextWindow(bookId, chapter, verse, 10),
      refLabel(bookId, chapter, verse),
    ]);
    if (!target) notFound('没有这一节');

    return { ref, target, before, after };
  });
}
