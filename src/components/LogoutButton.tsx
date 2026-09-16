'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/login');
  }

  return (
    <button className="btn-ghost mt-5 w-full py-3 text-accent" onClick={logout}>
      退出登录
    </button>
  );
}
