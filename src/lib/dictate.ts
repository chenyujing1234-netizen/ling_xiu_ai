'use client';

import { api } from './client';

/**
 * 把一段录音送去识别，只拿回文字。
 *
 * 音频不落盘、不入库（见 /api/transcribe），所以这里只在内存里转一道。
 */
export async function transcribe(blob: Blob): Promise<string> {
  const form = new FormData();
  // 服务端靠扩展名判断容器格式，iOS 录出来的是 m4a/aac，其余多是 webm/opus
  form.append('file', blob, /mp4|m4a|aac/.test(blob.type) ? 'note.m4a' : 'note.webm');
  const res = await api<{ text: string }>('/api/transcribe', { method: 'POST', body: form });
  return res.text.trim();
}

/** 口述的内容接在已有文字后面，不冲掉他自己打的那半句 */
export function joinDictation(prev: string, said: string, sep = '\n'): string {
  return prev.trim() ? `${prev.trim()}${sep}${said}` : said;
}
