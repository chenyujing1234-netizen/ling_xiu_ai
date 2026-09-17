import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

// 灵修录音与手写笔记是很私密的东西，所以不放在 public/ 下公开可取，
// 而是存到 data/uploads/，经 /api/media 鉴权后才返回（见 app/api/media）。
const UPLOAD_ROOT = () => process.env.UPLOAD_DIR || join(process.cwd(), 'data', 'uploads');

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export function extFor(mime: string): string | null {
  return EXT[mime.split(';')[0].trim()] ?? null;
}

/** 保存上传文件，返回可存库的相对路径（形如 3/ab12cd34.webm） */
export async function saveUpload(userId: number, file: Blob, mime: string): Promise<string> {
  const ext = extFor(mime);
  if (!ext) throw new Error(`不支持的文件类型：${mime}`);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('文件过大（上限 12MB）');

  const dir = join(UPLOAD_ROOT(), String(userId));
  await mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}${randomBytes(4).toString('hex')}.${ext}`;
  await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `${userId}/${name}`;
}

const MIME_BY_EXT: Record<string, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  png: 'image/png',
  jpg: 'image/jpeg',
};

/** 读取媒体文件。relPath 必须是 saveUpload 返回的格式，这里再做一次路径校验防穿越 */
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
 * 保存意境配图，返回可直接给 <img> 用的地址。
 *
 * 供图接口给的是 23 小时后过期的对象存储链接，存库当长期地址第二天就成裂图，
 * 所以下载落地。配图按经文缓存、属于公共内容（不含任何个人信息），
 * 因此不放进按用户分目录的私密区，登录用户都能看。
 */
export async function saveSceneImage(data: Buffer, ext: 'png' | 'jpg' = 'png'): Promise<string> {
  const dir = join(UPLOAD_ROOT(), SCENE_DIR);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}${randomBytes(4).toString('hex')}.${ext}`;
  await writeFile(join(dir, name), data);
  return `/api/scene/${name}`;
}

export async function readSceneImage(name: string) {
  if (!/^[A-Za-z0-9]+\.(png|jpg)$/.test(name)) throw new Error('非法文件名');
  const ext = name.split('.').pop() ?? 'png';
  const data = await readFile(join(UPLOAD_ROOT(), SCENE_DIR, name));
  return { data, mime: MIME_BY_EXT[ext] ?? 'image/png' };
}
