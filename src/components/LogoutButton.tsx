'use client';

import { api, hardNavigate } from '@/lib/client';
import { DEVOTION_TAB_KEY } from './BottomTab';

export default function LogoutButton() {
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
    // 「灵修」Tab 的停留记录跟随账号，登出时一并清掉，免得下个登录的人恢复到别人的灵修页
    try {
      sessionStorage.removeItem(DEVOTION_TAB_KEY);
    } catch {
      /* 存不了 sessionStorage 的环境里本来也没记录 */
    }
    hardNavigate('/login');
  }

  return (
    <button className="btn-ghost mt-5 w-full py-3 text-accent" onClick={logout}>
      退出登录
    </button>
  );
}
