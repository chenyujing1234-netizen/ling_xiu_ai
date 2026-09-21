/** 全站字号档位（与 globals.css 中 data-font-scale 一致） */
export const FONT_SCALE_IDS = ['small', 'standard', 'large', 'xlarge'] as const;
export type FontScaleId = (typeof FONT_SCALE_IDS)[number];

export type FontScaleMeta = {
  id: FontScaleId;
  name: string;
  desc: string;
  /** 相对原稿 100% 的大致比例，仅用于展示 */
  percent: number;
};

export const FONT_SCALES: FontScaleMeta[] = [
  { id: 'small', name: '偏小', desc: '信息密度高、屏上内容多', percent: 94 },
  { id: 'standard', name: '标准', desc: '默认，比旧版整体略大', percent: 108 },
  { id: 'large', name: '偏大', desc: '长时间阅读更省力', percent: 116 },
  { id: 'xlarge', name: '特大', desc: '视力弱或大屏远距离', percent: 124 },
];

const SET = new Set<string>(FONT_SCALE_IDS);

export function normalizeFontScale(raw: string | null | undefined): FontScaleId {
  if (raw && SET.has(raw)) return raw as FontScaleId;
  return 'standard';
}

export const FONT_SCALE_STORAGE_KEY = 'lx_font_scale';
export const FONT_SCALE_COOKIE = 'lx_font_scale';

export function applyFontScaleClient(id: FontScaleId) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-font-scale', id);
  try {
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  const maxAge = 365 * 24 * 3600;
  document.cookie = `${FONT_SCALE_COOKIE}=${encodeURIComponent(id)};path=/;max-age=${maxAge};SameSite=Lax`;
}
