import { redirect } from 'next/navigation';
import BottomTab from '@/components/BottomTab';
import { getSession } from '@/lib/auth';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // 中间件已挡过一层；这里再查一次数据库，确保被停用的账号立即失效（R-A1）。
  // 强制改密的跳转由中间件负责，避免与改密页本身互相重定向。
  if (!session) redirect('/login');

  return (
    <>
      <main className="page">{children}</main>
      <BottomTab />
    </>
  );
}
