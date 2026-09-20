/** 界面风格预设 id（与 themes.css 中 data-theme 一致） */
export const THEME_IDS = ['classic', 'sea', 'olive', 'night'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  desc: string;
  /** 预览色：背景、主色、强调 */
  swatch: [string, string, string];
};

export const THEMES: ThemeMeta[] = [
  {
    id: 'classic',
    name: '晨光',
    desc: '羊皮纸与暖褐，默认阅读感',
    swatch: ['#fbf8f1', '#8a6d3b', '#9c5b3f'],
  },
  {
    id: 'sea',
    name: '静海',
    desc: '偏冷的纸色与深蓝，清爽安静',
    swatch: ['#f4f7fa', '#3d6b8c', '#c45c4a'],
  },
  {
    id: 'olive',
    name: '橄榄',
    desc: '微绿纸面，适合长时间默想',
    swatch: ['#f6f7f2', '#5a6b4a', '#8b6914'],
  },
  {
    id: 'night',
    name: '夜读',
    desc: '深色底，弱对比护眼',
    swatch: ['#1c1b19', '#c9a86c', '#d4846a'],
  },
];

const SET = new Set<string>(THEME_IDS);

export function normalizeTheme(raw: string | null | undefined): ThemeId {
  if (raw && SET.has(raw)) return raw as ThemeId;
  return 'classic';
}

export const THEME_STORAGE_KEY = 'lx_theme';
export const THEME_COOKIE = 'lx_theme';

/** 首屏防闪烁：在 React 前写入 data-theme */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )lx_theme=([^;]+)/);var t=m&&decodeURIComponent(m[1])||localStorage.getItem('lx_theme')||'classic';if(!/^(classic|sea|olive|night)$/.test(t))t='classic';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export function applyThemeClient(id: ThemeId) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', id);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  const maxAge = 365 * 24 * 3600;
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(id)};path=/;max-age=${maxAge};SameSite=Lax`;
  const meta = document.querySelector('meta[name="theme-color"]');
  const rgb = getComputedStyle(document.documentElement).getPropertyValue('--tw-paper').trim();
  if (meta && rgb) meta.setAttribute('content', `rgb(${rgb.replace(/\s+/g, ', ')})`);
}
