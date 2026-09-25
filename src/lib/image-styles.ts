/** 经文意境配图的视觉风格（与文生图提示词片段对应） */
export const IMAGE_STYLE_IDS = [
  'classic',
  'watercolor',
  'ink',
  'night',
  'illustration',
  'parchment',
  'cinematic',
] as const;

export type ImageStyleId = (typeof IMAGE_STYLE_IDS)[number];

export type ImageStyleMeta = {
  id: ImageStyleId;
  name: string;
  desc: string;
  /** 注入到 imagePrompt* 的「风格」句 */
  prompt: string;
};

export const IMAGE_STYLES: ImageStyleMeta[] = [
  {
    id: 'classic',
    name: '古典油画',
    desc: '暖色、庄重、默认意境',
    prompt:
      '古典油画质感，柔和暖色光线，庄重肃穆，写实但带诗意，广角构图',
  },
  {
    id: 'watercolor',
    name: '水彩淡彩',
    desc: '通透温柔、适合默想',
    prompt:
      '水彩淡彩，纸纹可见，边缘晕染，低饱和暖色，轻盈通透，留白呼吸感',
  },
  {
    id: 'ink',
    name: '水墨写意',
    desc: '留白远山、东方意境',
    prompt:
      '中国水墨写意，大量留白，远山近水，笔意简练，单色与淡彩，诗意空灵',
  },
  {
    id: 'night',
    name: '夜祷烛光',
    desc: '深色底、烛光或星光',
    prompt:
      '深色背景，烛光或微弱星光，高对比但柔和，安静夜祷氛围，局部暖光',
  },
  {
    id: 'illustration',
    name: '现代插画',
    desc: '清晰扁平、色块干净',
    prompt:
      '现代扁平插画，清晰轮廓，色块干净，适度简化细节，温暖但不花哨',
  },
  {
    id: 'parchment',
    name: '羊皮卷轴',
    desc: '复古手绘、卷轴质感',
    prompt:
      '羊皮纸卷轴质感，复古手绘线稿与淡彩，边缘做旧，中世纪手抄本装饰感但不过度繁复',
  },
  {
    id: 'cinematic',
    name: '电影宽银幕',
    desc: '戏剧性光效、景深',
    prompt:
      '电影级宽银幕构图，戏剧性自然光，浅景深，史诗感但不暴力血腥',
  },
];

const STYLE_SET = new Set<string>(IMAGE_STYLE_IDS);

export function normalizeImageStyle(raw: string | null | undefined): ImageStyleId {
  if (raw && STYLE_SET.has(raw)) return raw as ImageStyleId;
  return 'classic';
}

export function imageStylePrompt(id: ImageStyleId): string {
  return IMAGE_STYLES.find((s) => s.id === id)?.prompt ?? IMAGE_STYLES[0].prompt;
}

/** passage_insights.kind：classic 沿用旧键 image，其它风格分键缓存 */
export function imageInsightCacheKind(style?: string | null): string {
  const id = normalizeImageStyle(style ?? undefined);
  return id === 'classic' ? 'image' : `image:${id}`;
}

export const IMAGE_STYLE_STORAGE_KEY = 'lx_image_style';

export function readStoredImageStyle(): ImageStyleId {
  if (typeof window === 'undefined') return 'classic';
  try {
    return normalizeImageStyle(localStorage.getItem(IMAGE_STYLE_STORAGE_KEY));
  } catch {
    return 'classic';
  }
}

export function writeStoredImageStyle(id: ImageStyleId) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(IMAGE_STYLE_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
