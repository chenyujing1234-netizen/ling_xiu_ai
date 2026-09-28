import { handler, intParam, bad, notFound } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { allBooks, getBook, getRange, getChapter, passageText, refLabel } from '@/lib/bible';

const MAX_CHAPTER_VERSES = 48;

/** 任务结果页等：按书卷/章/节取经文正文 */
export async function GET(req: Request) {
  return handler(async () => {
    await requireSession();
    const url = new URL(req.url);
    const bookName = url.searchParams.get('bookName')?.trim();
    let bookId = url.searchParams.has('book') ? intParam(req, 'book') : 0;
    const chapter = intParam(req, 'chapter');
    const from = intParam(req, 'from', 0);
    const to = intParam(req, 'to', 0);

    if (bookName) {
      const books = await allBooks();
      const hit =
        books.find((b) => b.name_cn === bookName) ??
        books.find((b) => b.name_cn.startsWith(bookName) || bookName.startsWith(b.name_cn));
      if (!hit) bad('无法识别经卷名');
      bookId = hit.id;
    }

    if (!bookId) bad('缺少 book 或 bookName');
    const book = await getBook(bookId);
    if (!book) notFound('没有这卷书');
    if (chapter < 1 || chapter > book.chapters) notFound(`${book.name_cn}只有 ${book.chapters} 章`);

    if (from > 0) {
      const end = to > 0 ? to : from;
      const verses = await getRange(bookId, chapter, from, end);
      if (!verses.length) notFound('没有这些经节');
      const ref = await refLabel(bookId, chapter, from, end);
      return {
        ref,
        cn: passageText(verses, 'cn'),
        en: passageText(verses, 'en'),
      };
    }

    const verses = await getChapter(bookId, chapter);
    if (!verses.length) notFound('本章暂无经文');
    const slice = verses.slice(0, MAX_CHAPTER_VERSES);
    const ref = await refLabel(bookId, chapter);
    const cn = passageText(slice, 'cn');
    const suffix = verses.length > slice.length ? `\n…（本章共 ${verses.length} 节，已省略后续）` : '';
    return {
      ref,
      cn: cn + suffix,
      en: passageText(slice, 'en'),
    };
  });
}
