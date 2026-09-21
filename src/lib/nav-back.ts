/** 底部 Tab 一级页：不显示全局「返回」 */
export const PRIMARY_TAB_PATHS = ['/', '/devotion', '/me'] as const;

export function isPrimaryTabPath(pathname: string): boolean {
  return (PRIMARY_TAB_PATHS as readonly string[]).includes(pathname);
}

/** 灵修流程页顶栏自带返回，不走 layout 条 */
export function isDevotionFlowPath(pathname: string): boolean {
  return /^\/devotion\/\d+$/.test(pathname);
}

export function shouldShowPageBack(pathname: string): boolean {
  if (isPrimaryTabPath(pathname)) return false;
  if (isDevotionFlowPath(pathname)) return false;
  return pathname.startsWith('/');
}

/** 无浏览器历史时的兜底跳转 */
export function backFallbackFor(pathname: string): string {
  if (pathname.startsWith('/devotion')) return '/devotion';
  if (pathname.startsWith('/me')) return '/me';
  if (pathname === '/admin') return '/me';
  return '/?home=1';
}
