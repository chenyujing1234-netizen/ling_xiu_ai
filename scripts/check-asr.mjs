#!/usr/bin/env node
/**
 * 口述转文字（ASR）自查。
 *
 * 口述笔记只保留识别出的文字、不存音频，所以这套配置不通，口述就用不了。
 * 换 key 或换服务商之后跑一下，能立刻看出是端点不对、鉴权不过还是模型名不对：
 *
 *   node scripts/check-asr.mjs              # 用内置的 2 秒静音测连通性
 *   node scripts/check-asr.mjs my.wav       # 用真实录音顺带看识别质量
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 读 .env.local，避免为了跑个自查还得先 export 一堆变量
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

const baseUrl = (process.env.AI_ASR_BASE_URL || process.env.AI_BASE_URL || '').replace(/\/$/, '');
const apiKey = process.env.AI_ASR_API_KEY || process.env.AI_API_KEY || '';
const model = process.env.AI_ASR_MODEL || '';

console.log('配置：');
console.log(`  地址  ${baseUrl || '（空）'}`);
console.log(`  key   ${apiKey ? `${apiKey.slice(0, 12)}…（${apiKey.length} 字符）` : '（空）'}`);
console.log(`  模型  ${model || '（空）'}\n`);

if (!baseUrl || !apiKey || !model) {
  console.log('× 配置不全。请在 .env.local 里填好 AI_ASR_MODEL');
  console.log('  （地址和 key 留空会沿用 AI_BASE_URL / AI_API_KEY）');
  process.exit(1);
}

/** 构造一段 16kHz 单声道静音 wav，省得为了自查还依赖 ffmpeg */
function silenceWav(seconds = 2, rate = 16000) {
  const bytes = seconds * rate * 2;
  const buf = Buffer.alloc(44 + bytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + bytes, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // 单声道
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(bytes, 40);
  return buf;
}

const path = process.argv[2];
const audio = path ? readFileSync(path) : silenceWav();
const name = path ? path.split('/').pop() : 'silence.wav';
if (!path) console.log('用内置的 2 秒静音测连通性（识别不出内容是正常的，看的是端点通不通）\n');

const form = new FormData();
form.append('file', new Blob([audio]), name);
form.append('model', model);

const started = Date.now();
let res;
try {
  res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
} catch (err) {
  console.log(`× 请求发不出去：${err.message}`);
  console.log('  多半是地址写错或网络不通。');
  process.exit(1);
}

const raw = await res.text();
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`HTTP ${res.status}，耗时 ${secs} 秒`);
console.log(`响应：${raw.slice(0, 400)}\n`);

if (!res.ok) {
  if (/model.*not.*exist|无效.*模型|InvalidParameter/i.test(raw)) {
    console.log(`× 这个服务不认 "${model}"。换一个转写模型名，或换支持转写的服务商。`);
  } else if (res.status === 401 || res.status === 403) {
    console.log('× 鉴权不过。检查 AI_ASR_API_KEY，以及这个 key 有没有开通转写权限。');
  } else if (res.status === 404) {
    console.log('× 这个服务没有 /audio/transcriptions 端点，需要换支持 OpenAI 兼容转写的服务商。');
  } else {
    console.log('× 转写失败，看上面的响应内容。');
  }
  process.exit(1);
}

let text = '';
try {
  const data = JSON.parse(raw);
  text = (data.text ?? data.output?.text ?? '').trim();
} catch {
  console.log('× 响应不是合法 JSON，这个端点可能不是 OpenAI 兼容的转写接口。');
  process.exit(1);
}

if (text) {
  console.log(`√ 转写可用，识别结果：${text}`);
} else if (path) {
  console.log('△ 端点通了，但没识别出内容。确认这个音频里有人声、格式也被支持。');
} else {
  console.log('√ 端点和模型都通了（静音自然没有内容）。');
  console.log('  想看识别质量，录一段说话再跑：node scripts/check-asr.mjs my.wav');
}
