import { z } from 'zod';
import { handler, body } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { sanitizeLastPath } from '@/lib/last-path';
import { setResumeCookie } from '@/lib/resume';
import { db } from '@/lib/db';

const Schema = z.object({
  path: z.string().max(512),
});

/** 记录用户最后停留的页面（关闭前 / 路由切换时上报） */
export async function POST(req: Request) {
  return handler(async () => {
    const session = await requireSession();
    const { path } = await body(req, Schema);
    const safe = sanitizeLastPath(path);
    if (!safe) return { ok: false };
    await db().prepare(`UPDATE users SET last_path = ? WHERE id = ?`).run(safe, session.uid);
    await setResumeCookie(safe);
    return { ok: true };
  });
}
