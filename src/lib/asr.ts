import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { AiError } from './ai';

/**
 * 口述转文字。
 *
 * 这套服务的转写能力藏在 realtime 模型里，HTTP 那几条路都不通：
 *   /audio/transcriptions 回 "Model not exist"；
 *   /chat/completions 与多模态端点传音频只回一个空壳 {"status_message":"Success."}。
 * 只有 realtime 的 WebSocket 会吐 conversation.item.input_audio_transcription.completed，
 * 实测 5.5 秒中文音频 1.1 秒出结果。
 *
 * 它只吃 16kHz 单声道 PCM16，而浏览器 MediaRecorder 只能给 opus/aac，
 * 所以先用 ffmpeg 转一道。音频全程在内存里，不落盘。
 */

const WS_URL = () => {
  if (process.env.AI_ASR_WS_URL) return process.env.AI_ASR_WS_URL;
  const base = process.env.AI_ASR_BASE_URL || process.env.AI_BASE_URL || '';
  const host = base.replace(/^https?:\/\//, '').split('/')[0];
  return host ? `wss://${host}/api-ws/v1/realtime` : '';
};

const API_KEY = () => process.env.AI_ASR_API_KEY || process.env.AI_API_KEY || '';
const MODEL = () => process.env.AI_ASR_MODEL || 'qwen-audio-3.0-realtime-plus';
/** realtime 会话里真正干转写活的那个模型 */
const ENGINE = () => process.env.AI_ASR_ENGINE || 'gummy-realtime-v1';

const SAMPLE_RATE = 16000;
/** 100ms 一片：太大容易被网关拆包，太小白费往返 */
const CHUNK = (SAMPLE_RATE / 10) * 2;

/**
 * 识别端一次只收 30 秒（超了直接回
 * "Input audio buffer exceeded maximum duration (30s)"），
 * 所以按 25 秒切段、逐段 commit，留 5 秒余量给切点浮动。
 */
const SEG_BYTES = 25 * SAMPLE_RATE * 2;
/** 切点在目标位置前后 2 秒内挑，最坏 27 秒，仍在 30 秒线内 */
const SEARCH = 2 * SAMPLE_RATE * 2;

/** 在 target 附近找最安静的 100ms，避免把一个词劈成两半 */
function quietestNear(pcm: Buffer, target: number): number {
  const from = Math.max(CHUNK, target - SEARCH) & ~1;
  const to = Math.min(pcm.length - CHUNK, target + SEARCH) & ~1;
  if (to <= from) return Math.min(target, pcm.length) & ~1;

  let best = to;
  let quietest = Infinity;
  for (let p = from; p <= to; p += CHUNK) {
    let sum = 0;
    for (let i = p; i < p + CHUNK; i += 2) sum += Math.abs(pcm.readInt16LE(i));
    if (sum < quietest) {
      quietest = sum;
      best = p;
    }
  }
  return best;
}

function splitPcm(pcm: Buffer): Buffer[] {
  if (pcm.length <= SEG_BYTES) return [pcm];
  const segs: Buffer[] = [];
  for (let start = 0; start < pcm.length; ) {
    if (pcm.length - start <= SEG_BYTES) {
      segs.push(pcm.subarray(start));
      break;
    }
    const cut = quietestNear(pcm, start + SEG_BYTES);
    segs.push(pcm.subarray(start, cut));
    start = cut;
  }
  return segs;
}

export function asrConfigured(): boolean {
  return Boolean(WS_URL() && API_KEY() && MODEL());
}

/** 用 ffmpeg 把任意浏览器录音转成 16kHz 单声道 PCM16 裸流 */
async function toPcm16(input: Buffer): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      '-ar', String(SAMPLE_RATE),
      '-ac', '1',
      'pipe:1',
    ]);

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    ff.stdout.on('data', (d: Buffer) => out.push(d));
    ff.stderr.on('data', (d: Buffer) => err.push(d));

    ff.on('error', (e) =>
      reject(
        new AiError(
          e.message.includes('ENOENT')
            ? '服务器上没有 ffmpeg，无法把录音转成识别所需的格式'
            : `转码失败：${e.message}`,
        ),
      ),
    );
    ff.on('close', (code) => {
      const pcm = Buffer.concat(out);
      if (code !== 0 || pcm.length === 0) {
        // ffmpeg 的英文日志对使用者没意义，留在服务端日志里供排查
        console.error('[asr:ffmpeg]', Buffer.concat(err).toString().slice(0, 500));
        reject(new AiError('这段录音打不开，请重新说一次'));
        return;
      }
      resolve(pcm);
    });

    ff.stdin.on('error', () => {
      /* ffmpeg 提前退出时 stdin 会 EPIPE，错误已由 close 分支处理 */
    });
    ff.stdin.end(input);
  });
}

/** 把 PCM 送进 realtime 会话，等它把转写结果吐回来 */
async function transcribePcm(pcm: Buffer, timeoutMs: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL()}?model=${encodeURIComponent(MODEL())}`, {
      headers: { Authorization: `Bearer ${API_KEY()}` },
    });

    let settled = false;
    const finish = (err: Error | null, text?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* 已经断了就算了 */
      }
      if (err) reject(err);
      else resolve(text ?? '');
    };

    const timer = setTimeout(
      () => finish(new AiError(`转写超时（${Math.round(timeoutMs / 1000)} 秒没有结果）`)),
      timeoutMs,
    );

    const segments = splitPcm(pcm);
    const parts: string[] = [];
    let sent = 0;

    /** 一段一段地送：commit 会清空缓冲，等这段的结果回来再送下一段 */
    const sendNext = () => {
      const seg = segments[sent++];
      for (let i = 0; i < seg.length; i += CHUNK) {
        ws.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: seg.subarray(i, i + CHUNK).toString('base64'),
          }),
        );
      }
      // 只 commit，不发 response.create：要的是转写，不是让模型搭话
      ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    };

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text'],
            input_audio_format: 'pcm16',
            input_audio_transcription: { model: ENGINE() },
            // 自己决定何时截止，别让服务端按静音把一句话切成几段
            turn_detection: null,
          },
        }),
      );
      sendNext();
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      let ev: { type?: string; transcript?: string; error?: { message?: string } };
      try {
        ev = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (ev.type === 'conversation.item.input_audio_transcription.completed') {
        parts.push((ev.transcript ?? '').trim());
        if (sent < segments.length) sendNext();
        else finish(null, parts.filter(Boolean).join(''));
      } else if (
        ev.type === 'conversation.item.input_audio_transcription.failed' ||
        ev.type === 'error'
      ) {
        finish(new AiError(`转写失败：${ev.error?.message ?? '识别服务未给出原因'}`));
      }
    });

    ws.on('error', (e: Error) => finish(new AiError(`连不上识别服务：${e.message}`)));
    ws.on('close', () => finish(new AiError('识别服务提前断开，没有拿到结果')));
  });
}

/**
 * 转写入口。失败一律抛错：录音不再留存，
 * 悄悄失败等于把人说的话丢掉，得让他知道并当场重说。
 */
export async function transcribeAudio(file: Blob): Promise<string> {
  if (!asrConfigured()) {
    throw new AiError('未配置语音识别，请检查 AI_BASE_URL / AI_API_KEY');
  }

  const pcm = await toPcm16(Buffer.from(await file.arrayBuffer()));
  const seconds = pcm.length / (SAMPLE_RATE * 2);
  if (seconds < 0.3) throw new AiError('说得太短了，请多说几句');

  // 识别本身很快（5 秒音频约 1 秒），但长录音要留出余量
  const timeoutMs = Math.min(180_000, 30_000 + seconds * 2000);
  const text = await transcribePcm(pcm, timeoutMs);
  if (!text) throw new AiError('没有识别到内容，请靠近话筒再说一次');
  return text;
}
