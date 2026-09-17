import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

// 灵修录音是很私密的东西，所以不放在 public/ 下公开可取，
// 而是存到 data/uploads/，经 /api/media 鉴权后才返回（见 app/api/media）。
// 现在笔记一律以文字入库，这里只剩读取历史文件的路径。
const UPLOAD_ROOT = () => process.env.UPLOAD_DIR || join(process.cwd(), 'data', 'uploads');

const MIME_BY_EXT: Record<string, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/** 读取媒体文件。relPath 必须是 `用户id/随机名.后缀` 的格式，这里再做一次路径校验防穿越 */
export async function readMedia(relPath: string) {
  if (!/^\d+\/[A-Za-z0-9]+\.[a-z0-9]{2,4}$/.test(relPath)) {
    throw new Error('非法路径');
  }
  const ext = relPath.split('.').pop() ?? '';
  const data = await readFile(join(UPLOAD_ROOT(), relPath));
  return { data, mime: MIME_BY_EXT[ext] ?? 'application/octet-stream' };
}

/** 从 relPath 解析出所属用户，用于越权校验 */
export function ownerOf(relPath: string): number {
  return Number(relPath.split('/')[0]);
}

// ---------- AI 生成的经文意境配图 ----------

const SCENE_DIR = 'scene';

/**
 * 供图接口回的是 1024×1024 无损 PNG，两百多万字节。这么大的图浏览器只能边下边画，
 * 在手机上就是一行一行往下刷，所以落地前统一转成 webp（同样尺寸，约 1/8 大小）。
 */
const SCENE_QUALITY = 82;

async function toWebp(data: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return await sharp(data).webp({ quality: SCENE_QUALITY }).toBuffer();
}

/**
 * 保存意境配图，返回可直接给 <img> 用的地址。
 *
 * 供图接口给的是 23 小时后过期的对象存储链接，存库当长期地址第二天就成裂图，
 * 所以下载落地。配图按经文缓存、属于公共内容（不含任何个人信息），
 * 因此不放进按用户分目录的私密区，登录用户都能看。
 */
export async function saveSceneImage(data: Buffer, ext: 'png' | 'jpg' = 'png'): Promise<string> {
  const dir = join(UPLOAD_ROOT(), SCENE_DIR);
  await mkdir(dir, { recursive: true });
  const base = `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;

  let name = `${base}.webp`;
  let out: Buffer;
  try {
    out = await toWebp(data);
  } catch {
    // 转码失败不该让好不容易生成出来的图丢掉，退回原图
    name = `${base}.${ext}`;
    out = data;
  }
  await writeFile(join(dir, name), out);
  return `/api/scene/${name}`;
}

export async function readSceneImage(name: string) {
  if (!/^[A-Za-z0-9]+\.(png|jpg|webp)$/.test(name)) throw new Error('非法文件名');
  const dir = join(UPLOAD_ROOT(), SCENE_DIR);
  const ext = name.split('.').pop() ?? 'png';
  if (ext === 'webp') {
    return { data: await readFile(join(dir, name)), mime: 'image/webp' };
  }

  // 早期存的是未压缩原图，地址已经进了库不能改，那就第一次访问时在旁边压一份 webp，之后都走它
  const slim = join(dir, `${name.slice(0, name.lastIndexOf('.'))}.webp`);
  try {
    return { data: await readFile(slim), mime: 'image/webp' };
  } catch {
    /* 还没压过，往下走 */
  }
  const raw = await readFile(join(dir, name));
  try {
    const data = await toWebp(raw);
    await writeFile(slim, data);
    return { data, mime: 'image/webp' };
  } catch {
    return { data: raw, mime: MIME_BY_EXT[ext] ?? 'image/png' };
  }
}
