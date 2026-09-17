'use client';

import { api, hardNavigate } from '@/lib/client';

export default function LogoutButton() {
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
    hardNavigate('/login');
  }

  return (
    <button className="btn-ghost mt-5 w-full py-3 text-accent" onClick={logout}>
      退出登录
    </button>
  );
}
