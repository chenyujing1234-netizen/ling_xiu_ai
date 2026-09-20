'use client';

import { useEffect } from 'react';
import { api } from '@/lib/client';
import { applyThemeClient, normalizeTheme, type ThemeId } from '@/lib/themes';

/** 登录后与服务器主题同步；未登录则沿用本地 / 默认 */
export default function ThemeProvider({ initialTheme }: { initialTheme?: string | null }) {
  useEffect(() => {
    const fromServer = normalizeTheme(initialTheme ?? undefined);
    applyThemeClient(fromServer);

    void (async () => {
      try {
        const res = await api<{ settings: { theme?: string } }>('/api/settings');
        const remote = normalizeTheme(res.settings?.theme);
        applyThemeClient(remote);
      } catch {
        /* 未登录或网络失败，保持 boot 脚本设好的主题 */
      }
    })();
  }, [initialTheme]);

  return null;
}

export function useThemeApply() {
  return (id: ThemeId) => applyThemeClient(id);
}
