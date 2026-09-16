import { handler } from '@/lib/api';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  return handler(async () => {
    await clearSessionCookie();
    return { ok: true };
  });
}
