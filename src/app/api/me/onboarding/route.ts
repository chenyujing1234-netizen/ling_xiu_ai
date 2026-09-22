import { handler } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';

/** 标记「首次使用指引」已读 */
export async function POST() {
  return handler(async () => {
    const session = await requireSession();
    await db()
      .prepare(`UPDATE reading_settings SET guide_seen = 1 WHERE user_id = ?`)
      .run(session.uid);
    return { ok: true };
  });
}
