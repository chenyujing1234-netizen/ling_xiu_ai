'use client';

import { useEffect } from 'react';
import { applyThemeClient, normalizeTheme } from '@/lib/themes';

/** 主站 layout 传入账号主题，减少登录后首屏闪色 */
export default function ThemeSync({ theme }: { theme: string }) {
  useEffect(() => {
    applyThemeClient(normalizeTheme(theme));
  }, [theme]);
  return null;
}
