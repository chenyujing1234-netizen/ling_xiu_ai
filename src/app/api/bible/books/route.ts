import { handler } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { allBooks } from '@/lib/bible';

export async function GET() {
  return handler(async () => {
    await requireSession();
    const books = (await allBooks()).map((b) => ({
      id: b.id,
      name: b.name_cn,
      chapters: b.chapters,
      testament: b.testament,
    }));
    return { books };
  });
}
