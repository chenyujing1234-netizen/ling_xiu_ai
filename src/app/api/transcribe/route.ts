import { handler, bad } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { transcribe } from '@/lib/ai';

/** 约 10MB，opus 编码下够说十几分钟，正常口述远到不了 */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * 口述转文字：音频只在内存里过一遍就交给识别服务，全程不落盘。
 * 前端拿到文字后走普通文字笔记保存，所以库里和磁盘上都不会留音频。
 */
export async function POST(req: Request) {
  return handler(async () => {
    await requireSession();

    const form = await req.formData().catch(() => bad('请求格式不正确'));
    const file = form.get('file');
    if (!(file instanceof Blob) || file.size === 0) bad('没有收到录音');
    if (file.size > MAX_BYTES) bad('录音太长了，请分几段说');

    const ext = /mp4|m4a|aac/.test(file.type) ? 'm4a' : 'webm';
    return { text: await transcribe(file, `note.${ext}`) };
  });
}
