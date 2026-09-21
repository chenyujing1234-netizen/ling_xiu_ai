import { handler } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { countPendingAccessRequests } from '@/lib/admin-pending';

/** 管理员：待审批使用申请数量（非管理员恒为 0） */
export async function GET() {
  return handler(async () => {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { pending: 0 };
    }
    return { pending: await countPendingAccessRequests() };
  });
}
