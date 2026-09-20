/** 允许恢复的站内路径：防 open redirect */
const BLOCKED_PREFIXES = ['/login', '/apply', '/api'];

export function sanitizeLastPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.length > 480) return null;
  for (const p of BLOCKED_PREFIXES) {
    if (path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`)) return null;
  }
  // 首次改密必须走改密页，不恢复到别的地址
  if (path.startsWith('/me/password')) return null;
  return path;
}
