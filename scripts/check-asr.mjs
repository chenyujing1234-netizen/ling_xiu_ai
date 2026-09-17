#!/usr/bin/env node
/**
 * 口述转文字（ASR）自查。
 *
 * 口述笔记只保留识别出的文字、不存音频，所以这条链路断了口述就用不了。
 * 脚本按真实调用顺序逐段检查：配置 → ffmpeg → WebSocket 握手 → 转写结果。
 *
 *   node scripts/check-asr.mjs            # 用静音测通路
 *   node scripts/check-asr.mjs my.webm    # 用真实录音，顺带看识别质量（任意格式）
 */
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import WebSocket from 'ws';

for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(join(process.cwd(), file), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* 没有这个文件就算了 */
  }
}

const base = process.env.AI_ASR_BASE_URL || process.env.AI_BASE_URL || '';
const host = base.replace(/^https?:\/\//, '').split('/')[0];
const wsUrl = process.env.AI_ASR_WS_URL || (host ? `wss://${host}/api-ws/v1/realtime` : '');
const key = process.env.AI_ASR_API_KEY || process.env.AI_API_KEY || '';
const model = process.env.AI_ASR_MODEL || 'qwen-audio-3.0-realtime-plus';
const engine = process.env.AI_ASR_ENGINE || 'gummy-realtime-v1';
const RATE = 16000;

console.log('1) 配置');
console.log(`   地址  ${wsUrl || '（空）'}`);
console.log(`   key   ${key ? `${key.slice(0, 12)}…（${key.length} 字符）` : '（空）'}`);
console.log(`   模型  ${model}  转写引擎 ${engine}`);
if (!wsUrl || !key) {
  console.log('\n× 配置不全，检查 .env.local 的 AI_BASE_URL / AI_API_KEY');
  process.exit(1);
}

const path = process.argv[2];
let pcm;

console.log('\n2) ffmpeg 转码（识别端只吃 16kHz 单声道 PCM16）');
if (path) {
  pcm = await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-f', 's16le', '-acodec', 'pcm_s16le', '-ar', String(RATE), '-ac', '1',
      'pipe:1',
    ]);
    const out = [];
    const err = [];
    ff.stdout.on('data', (d) => out.push(d));
    ff.stderr.on('data', (d) => err.push(d));
    ff.on('error', (e) =>
      reject(new Error(e.message.includes('ENOENT') ? '服务器上没装 ffmpeg' : e.message)),
    );
    ff.on('close', (code) => {
      const buf = Buffer.concat(out);
      if (code !== 0 || !buf.length) reject(new Error(Buffer.concat(err).toString().slice(0, 200) || '转码没有输出'));
      else resolve(buf);
    });
    ff.stdin.on('error', () => {});
    ff.stdin.end(readFileSync(path));
  }).catch((e) => {
    console.log(`   × ${e.message}`);
    console.log('\n没装的话： apt-get install -y ffmpeg');
    process.exit(1);
  });
  console.log(`   √ ${path} → ${pcm.length} 字节 ≈ ${(pcm.length / (RATE * 2)).toFixed(1)} 秒`);
} else {
  pcm = Buffer.alloc(RATE * 2 * 2, 0);
  console.log('   （跳过，用 2 秒静音测通路；想看识别质量就传一个录音文件）');
}

console.log('\n3) 连接并转写');
const started = Date.now();
const ws = new WebSocket(`${wsUrl}?model=${encodeURIComponent(model)}`, {
  headers: { Authorization: `Bearer ${key}` },
});

let settled = false;
const done = (code) => {
  if (settled) return;
  settled = true;
  try {
    ws.close();
  } catch {}
  setTimeout(() => process.exit(code), 300);
};

ws.on('open', () => {
  console.log('   √ 握手成功');
  ws.send(
    JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text'],
        input_audio_format: 'pcm16',
        input_audio_transcription: { model: engine },
        turn_detection: null,
      },
    }),
  );
  const CHUNK = (RATE / 10) * 2;
  for (let i = 0; i < pcm.length; i += CHUNK) {
    ws.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: pcm.subarray(i, i + CHUNK).toString('base64'),
      }),
    );
  }
  ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
});

ws.on('message', (raw) => {
  let ev;
  try {
    ev = JSON.parse(raw.toString());
  } catch {
    return;
  }

  if (ev.type === 'conversation.item.input_audio_transcription.completed') {
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    const text = (ev.transcript ?? '').trim();
    if (text) {
      console.log(`   √ ${secs} 秒返回：${text}`);
      console.log('\n√ 口述转文字可用');
    } else if (path) {
      console.log(`   △ ${secs} 秒返回空结果`);
      console.log('\n△ 链路是通的，但这段音频没识别出内容。确认里面有人声。');
    } else {
      console.log(`   √ ${secs} 秒返回空结果（静音本就没内容）`);
      console.log('\n√ 链路通了。想验证识别质量： node scripts/check-asr.mjs 你的录音.webm');
    }
    done(0);
  } else if (
    ev.type === 'conversation.item.input_audio_transcription.failed' ||
    ev.type === 'error'
  ) {
    console.log(`   × ${JSON.stringify(ev.error ?? ev).slice(0, 300)}`);
    console.log('\n× 转写失败。若提示模型不存在，检查 AI_ASR_MODEL / AI_ASR_ENGINE。');
    done(1);
  }
});

ws.on('error', (e) => {
  console.log(`   × 连不上：${e.message}`);
  console.log('\n× 检查网络，以及 key 有没有 realtime 权限。');
  done(1);
});
ws.on('close', () => {
  if (!settled) {
    console.log('   × 服务端提前断开，没拿到转写结果');
    done(1);
  }
});
setTimeout(() => {
  if (!settled) {
    console.log('   × 40 秒没等到结果');
    done(1);
  }
}, 40000);
