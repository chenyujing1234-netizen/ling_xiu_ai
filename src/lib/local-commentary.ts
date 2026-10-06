/**
 * 本地按章 txt 注释（马唐纳 / 丁道尔）：从 book/ 下的按章文本直读，不走知识库、不经 LLM。
 *
 * 目录：book/{来源目录}/{两位卷号}{卷名}/第{两位章号}章.txt（第00章为绪论）。
 * 正文以【本章概述】【第N节】【第N-M节】【第N，M节】【第3a节】等标记分段；
 * 个别章只有概述没有逐节标记（如马唐纳的利未记第1章），单节弹窗回退用概述，内联不展示。
 */

import { readdir, readFile } from 'fs/promises';
import path from 'path';

export type LocalCommentarySourceId = 'macdonald' | 'tyndale';

export type LocalCommentarySource = {
  id: LocalCommentarySourceId;
  /** 呈现名，如「马唐纳」 */
  label: string;
  /** book/ 下的目录名 */
  dirName: string;
  /** 覆盖目录的环境变量名 */
  dirEnv: string;
};

export const LOCAL_COMMENTARY_SOURCES: Record<LocalCommentarySourceId, LocalCommentarySource> = {
  macdonald: {
    id: 'macdonald',
    label: '马唐纳',
    dirName: 'chajing.fuyin.tv马唐纳注释按章txt',
    dirEnv: 'MACDONALD_COMMENTARY_DIR',
  },
  tyndale: {
    id: 'tyndale',
    label: '丁道尔',
    dirName: 'chajing.fuyin.tv丁道尔圣经注释按章txt',
    dirEnv: 'TYNDALE_COMMENTARY_DIR',
  },
};

/** 来源固定展示顺序：马唐纳在前 */
export const LOCAL_COMMENTARY_ORDER: LocalCommentarySourceId[] = ['macdonald', 'tyndale'];

/** 本地文本根目录，可用对应环境变量覆盖 */
export function localCommentaryDir(source: LocalCommentarySource): string {
  return (
    process.env[source.dirEnv]?.trim() ||
    path.join(process.cwd(), 'book', source.dirName)
  );
}

export type LocalCommentarySection = {
  /** 标记原文（不含括号），如「第3-5节」「第3b节」 */
  header: string;
  /** 覆盖的节号区间（含端点；字母节号如 3b 归入第 3 节） */
  from: number;
  to: number;
  text: string;
};

export type LocalCommentaryChapter = {
  /** 文件首行标题，如《马唐纳注释·创世记》第1章 */
  title: string;
  overview: string;
  sections: LocalCommentarySection[];
};

const dirCaches = new Map<string, { at: number; books: string[] }>();
const DIR_CACHE_MS = 10 * 60_000;

async function bookDirNames(source: LocalCommentarySource): Promise<string[]> {
  const cached = dirCaches.get(source.id);
  if (cached && Date.now() - cached.at < DIR_CACHE_MS) return cached.books;
  try {
    const entries = await readdir(localCommentaryDir(source), { withFileTypes: true });
    const books = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    dirCaches.set(source.id, { at: Date.now(), books });
    return books;
  } catch {
    return [];
  }
}

/** 书卷目录名（bookId 1-66 对应目录前缀 01-66）；不存在返回 null */
async function bookDir(source: LocalCommentarySource, bookId: number): Promise<string | null> {
  const prefix = String(bookId).padStart(2, '0');
  const hit = (await bookDirNames(source)).find((name) => name.startsWith(prefix));
  return hit ?? null;
}

/**
 * 识别一行是否为节段标记：【第3节】【第3-5节】【第3，5节】【第3第5节】【第3b节】等变体。
 * 字母节号（3a/3b）按其数字归节，即 3b 覆盖第 3 节。
 */
export function parseVerseHeader(line: string): { header: string; from: number; to: number } | null {
  if (!line.startsWith('【') || !line.endsWith('】')) return null;
  const inner = line.slice(1, -1).replace(/\s+/g, '');
  if (!/^第\d+[ab]?([-–—~～,，、和第在]*\d+[ab]?)*节$/.test(inner)) return null;
  const nums = inner.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return null;
  return { header: inner, from: Math.min(...nums), to: Math.max(...nums) };
}

/** 按行解析一章文本；段落间的空行压成单个换行保留 */
export function parseLocalChapter(raw: string): LocalCommentaryChapter {
  const lines = raw.split(/\r?\n/);
  const title = (lines[0] ?? '').trim();
  const overview: string[] = [];
  const sectionLines: string[][] = [];
  const sections: LocalCommentarySection[] = [];
  let inOverview = false;

  /** 空行只在前一行非空时压成一个换行，避免空段堆积 */
  const push = (arr: string[], s: string) => {
    if (!s) {
      if (arr.length && arr[arr.length - 1] !== '') arr.push('');
      return;
    }
    arr.push(s);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '【本章概述】') {
      inOverview = true;
      continue;
    }
    const header = parseVerseHeader(trimmed);
    if (header) {
      sections.push({ header: header.header, from: header.from, to: header.to, text: '' });
      sectionLines.push([]);
      inOverview = false;
      continue;
    }
    if (!trimmed || trimmed === '返回本书目录 |') continue;
    if (sectionLines.length) push(sectionLines[sectionLines.length - 1]!, trimmed);
    else if (inOverview) push(overview, trimmed);
  }

  for (let i = 0; i < sections.length; i++) {
    sections[i]!.text = sectionLines[i]!.join('\n').trim();
  }

  return { title, overview: overview.join('\n').trim(), sections };
}

/** 进程内章节缓存：一章解析一次，整页逐节注释复用；每个来源上限 24 章防膨胀 */
const chapterCaches = new Map<string, Map<string, LocalCommentaryChapter | null>>();
const CHAPTER_CACHE_MAX = 24;

export type LocalChapterLookup =
  | { status: 'no-book' }
  | { status: 'no-chapter'; bookName: string }
  | { status: 'ok'; chapter: LocalCommentaryChapter };

/** 按章取整章解析结果（带进程内缓存） */
export async function lookupLocalChapter(
  source: LocalCommentarySource,
  bookId: number,
  chapter: number,
): Promise<LocalChapterLookup> {
  const dir = await bookDir(source, bookId);
  if (!dir) return { status: 'no-book' };
  const bookName = dir.replace(/^\d+/, '');

  let cache = chapterCaches.get(source.id);
  if (!cache) {
    cache = new Map();
    chapterCaches.set(source.id, cache);
  }
  const key = `${bookId}-${chapter}`;
  if (cache.has(key)) {
    const hit = cache.get(key);
    return hit ? { status: 'ok', chapter: hit } : { status: 'no-chapter', bookName };
  }

  const file = path.join(localCommentaryDir(source), dir, `第${String(chapter).padStart(2, '0')}章.txt`);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    cache.set(key, null);
    return { status: 'no-chapter', bookName };
  }
  if (!raw.trim()) {
    cache.set(key, null);
    return { status: 'no-chapter', bookName };
  }

  const parsed = parseLocalChapter(raw);
  if (cache.size >= CHAPTER_CACHE_MAX) cache.clear();
  cache.set(key, parsed);
  return { status: 'ok', chapter: parsed };
}

export type LocalVerseLookup =
  | { status: 'no-book' }
  | { status: 'no-chapter'; bookName: string }
  | { status: 'ok'; excerpt: LocalVerseExcerpt };

export type LocalVerseExcerpt = {
  title: string;
  overview: string;
  /** 覆盖目标节的分段，范围最窄的在前 */
  verseSections: LocalCommentarySection[];
};

/** 查某卷某章某节的注释；区分「卷目录缺失 / 章文件缺失 / 命中」三种情况 */
export async function lookupLocalVerse(
  source: LocalCommentarySource,
  bookId: number,
  chapter: number,
  verse: number,
): Promise<LocalVerseLookup> {
  const lookup = await lookupLocalChapter(source, bookId, chapter);
  if (lookup.status === 'no-book') return { status: 'no-book' };
  if (lookup.status === 'no-chapter') return { status: 'no-chapter', bookName: lookup.bookName };

  const verseSections = lookup.chapter.sections
    .filter((s) => verse >= s.from && verse <= s.to)
    .sort((a, b) => a.to - a.from - (b.to - b.from));

  return {
    status: 'ok',
    excerpt: {
      title: lookup.chapter.title,
      overview: lookup.chapter.overview,
      verseSections,
    },
  };
}

export type LocalInlineItem = {
  /** 注释挂载的节：该分段覆盖范围内最靠前的节 */
  verse: number;
  /** 分段标记原文，如「第3-5节」 */
  header: string;
  text: string;
};

/**
 * 整段经文的内联注释：每节取覆盖范围最窄的分段，一个分段只挂载一次
 * （挂在覆盖范围内最前的节下），避免相邻节重复同一段长文。
 * 只有逐节分段命中才返回，不含整章概述回退（内联场景重复展示概述太长）。
 */
export async function localInlineSections(
  source: LocalCommentarySource,
  bookId: number,
  chapter: number,
  verseFrom: number,
  verseTo: number,
): Promise<{ title: string; items: LocalInlineItem[] }> {
  const lookup = await lookupLocalChapter(source, bookId, chapter);
  if (lookup.status !== 'ok') return { title: '', items: [] };

  const sections = lookup.chapter.sections.filter((s) => s.text.trim());
  const narrowest = new Map<number, LocalCommentarySection>();
  for (const s of sections) {
    for (let v = Math.max(s.from, verseFrom); v <= Math.min(s.to, verseTo); v++) {
      const cur = narrowest.get(v);
      if (!cur || s.to - s.from < cur.to - cur.from) narrowest.set(v, s);
    }
  }

  const items: LocalInlineItem[] = [];
  const placed = new Set<LocalCommentarySection>();
  for (const v of [...narrowest.keys()].sort((a, b) => a - b)) {
    const s = narrowest.get(v)!;
    if (placed.has(s)) continue;
    placed.add(s);
    items.push({ verse: v, header: s.header, text: s.text.trim() });
  }
  return { title: lookup.chapter.title, items };
}

export type LocalCommentaryResult = {
  /** 是否取到了可呈现的注释文本 */
  found: boolean;
  /** 注释正文：原文照录，段落间以空行分隔 */
  body: string;
  /** 出处与覆盖范围说明（呈现给读者） */
  note: string;
};

/** 取某节的注释：本地文本直读，原文呈现，不经过 LLM */
export async function localVerseCommentary(
  source: LocalCommentarySource,
  bookId: number,
  chapter: number,
  verse: number,
): Promise<LocalCommentaryResult> {
  const lookup = await lookupLocalVerse(source, bookId, chapter, verse);

  if (lookup.status === 'no-book') {
    return {
      found: false,
      body: '',
      note: `本地《${source.label}注释》没有该卷的文本。`,
    };
  }
  if (lookup.status === 'no-chapter') {
    return {
      found: false,
      body: '',
      note: `本地《${source.label}注释》暂无 ${lookup.bookName}第${chapter}章 的文本。`,
    };
  }

  const { title, overview, verseSections } = lookup.excerpt;
  const sections = verseSections.filter((s) => s.text.trim());
  if (sections.length) {
    return {
      found: true,
      body: sections.map((s) => s.text.trim()).join('\n\n'),
      note: `原文摘自${title}（${sections.map((s) => s.header).join('、')}）`,
    };
  }
  if (overview) {
    return {
      found: true,
      body: overview,
      note: `${title} 未逐节注释本章，以下为整章概述。`,
    };
  }
  return {
    found: false,
    body: '',
    note: `${title} 未含第${verse}节的注释文本。`,
  };
}
