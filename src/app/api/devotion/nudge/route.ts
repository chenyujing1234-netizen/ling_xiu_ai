import { handler, intParam } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { generateNudges } from '@/lib/devotion';

// R-D5：读完却写不出感悟时，智能体主动发问把他拉回来
export async function GET(req: Request) {
  return handler(async () => {
    await requireSession();
    const bookId = intParam(req, 'book');
    const chapter = intParam(req, 'chapter');
    const from = intParam(req, 'from', 1);
    const to = intParam(req, 'to', 0);
    return { questions: await generateNudges(bookId, chapter, from, to) };
  });
}
