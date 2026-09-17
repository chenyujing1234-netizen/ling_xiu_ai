import { handler, intParam, bad } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import {
  getElements,
  getContextInsight,
  getGraph,
  getMindmap,
  getSceneImage,
  resolveRange,
  isCached,
} from '@/lib/insights';
import { db } from '@/lib/db';
import { UNLOCK_SCORE } from '@/lib/devotion';

/**
 * 结构化洞察。
 *
 * 这里有一条产品级约束（R-D1/R-D2）：人物、时间、地点、背景属于"知识性补充"，
 * 可以直接给；但**核心要义与反思**是解读，必须等他自己先思考过、
 * 或该段灵修已解锁，才返回。锁在服务端，不是前端遮一层。
 */
export async function GET(req: Request) {
  return handler(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const kind = url.searchParams.get('kind') ?? 'elements';
    const bookId = intParam(req, 'book');
    const chapter = intParam(req, 'chapter');
    const force = url.searchParams.get('force') === '1' && session.role === 'admin';
    // 只取已生成过的结果：命中就返回，没有就回 null，绝不在这里触发 AI 生成
    const cacheOnly = url.searchParams.get('cacheOnly') === '1';

    if (kind === 'context') {
      const verse = intParam(req, 'verse');
      if (cacheOnly && !(await isCached(bookId, chapter, kind, { verse }))) return { kind, data: null };
      return { kind, data: await getContextInsight(bookId, chapter, verse, force) };
    }

    const from = intParam(req, 'from', 1);
    const to = intParam(req, 'to', 0);

    if (cacheOnly && kind !== 'meta' && !(await isCached(bookId, chapter, kind, { from, to }))) {
      return { kind, data: null };
    }

    switch (kind) {
      case 'elements': {
        const data = await getElements(bookId, chapter, from, to, force);
        const unlocked = await hasUnlocked(session.uid, bookId, chapter);
        if (unlocked) return { kind, data, unlocked };
        // 未解锁：抽掉解读性内容，保留基础事实
        const { thesis, reflection, ...rest } = data;
        return {
          kind,
          data: { ...rest, thesis: null, reflection: null },
          unlocked: false,
          lockedHint: `要义与反思需要你先在灵修中写下自己的思考（评估达 ${UNLOCK_SCORE()} 分）后揭晓`,
        };
      }
      case 'graph':
        return { kind, data: await getGraph(bookId, chapter, from, to, force) };
      case 'mindmap':
        return { kind, data: await getMindmap(bookId, chapter, from, to, force) };
      case 'image':
        return { kind, data: await getSceneImage(bookId, chapter, from, to) };
      case 'meta':
        return { kind, data: await resolveRange(bookId, chapter, from, to) };
      default:
        bad(`未知的 kind: ${kind}`);
    }
  });
}

/** 该用户在这一章是否已经通过自己的思考解锁过 */
async function hasUnlocked(userId: number, bookId: number, chapter: number): Promise<boolean> {
  const row = await db()
    .prepare(
      `SELECT 1 FROM devotions
       WHERE user_id = ? AND book_id = ? AND chapter = ? AND unlocked = 1 LIMIT 1`,
    )
    .get(userId, bookId, chapter);
  return Boolean(row);
}
