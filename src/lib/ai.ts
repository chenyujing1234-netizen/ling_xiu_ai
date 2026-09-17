/**
 * AI 适配层：走 OpenAI 兼容协议（当前接阿里百炼 tokenplan）。
 * 换供应商只需改 .env 的 AI_BASE_URL / AI_API_KEY / AI_MODEL。
 *
 * 三个踩过的坑：
 * 1) 这批模型都是推理模型：思考过程在 reasoning_content，答案在 content。
 * 2) **reasoning 也算 completion tokens**，实测一次要烧 1000-2800 token。
 *    max_tokens 给小了会把答案挤掉，返回被截断的 JSON。所以下限给到 4000。
 * 3) 单次调用 20-70 秒是常态，超时必须给足，否则永远在跑降级引擎。
 */

const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_TIMEOUT_MS = 210_000;

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const BASE_URL = () => (process.env.AI_BASE_URL || '').replace(/\/$/, '');
const API_KEY = () => process.env.AI_API_KEY || '';

export const MODELS = {
  main: () => process.env.AI_MODEL || 'qwen3.8-max',
  fast: () => process.env.AI_MODEL_FAST || process.env.AI_MODEL || 'qwen3.8-flash',
  image: () => process.env.AI_MODEL_IMAGE || '',
};

export function aiConfigured(): boolean {
  return Boolean(BASE_URL() && API_KEY());
}

export class AiError extends Error {}

type ChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
};

export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  if (!aiConfigured()) throw new AiError('AI 未配置');

  const body: Record<string, unknown> = {
    model: opts.model ?? MODELS.main(),
    messages,
    temperature: opts.temperature ?? 0.7,
    // 要为 reasoning 留出预算，否则答案会被思考挤掉
    max_tokens: Math.max(opts.maxTokens ?? DEFAULT_MAX_TOKENS, DEFAULT_MAX_TOKENS),
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY()}`,
      },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new AiError(`AI 请求失败 ${res.status}: ${detail.slice(0, 300)}`);
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    const msg = choice?.message;
    const content: string = msg?.content?.trim() || '';

    // 被 max_tokens 截断时一律报错。截断的 JSON 仍可能被"最后一个花括号"
    // 兜底解析成看似合法但内容缺失的对象（例如四个评分维度只剩一个），
    // 那比直接失败更糟 —— 会得到一个错的分数却毫无察觉。
    if (choice?.finish_reason === 'length') {
      throw new AiError('AI 输出被长度限制截断，请提高 max_tokens');
    }
    if (content) return content;

    // 极少数情况答案落在 reasoning_content 里，兜一下
    const reasoning: string = msg?.reasoning_content?.trim() || '';
    if (reasoning) return reasoning;
    throw new AiError('AI 返回内容为空');
  } catch (err) {
    if (err instanceof AiError) throw err;
    if ((err as Error).name === 'AbortError') throw new AiError('AI 请求超时');
    throw new AiError(`AI 调用异常: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export type StreamEvent =
  | { type: 'thinking' }
  | { type: 'delta'; text: string }
  | { type: 'done'; text: string };

/**
 * 流式对话。引导揭晓这一步用主模型要 1-2 分钟，静等太难受，
 * 所以逐字推给前端。推理模型会先吐 reasoning_content —— 那部分不展示原文，
 * 只发一个 thinking 信号让界面显示"正在默想"。
 */
export async function* chatStream(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): AsyncGenerator<StreamEvent> {
  if (!aiConfigured()) throw new AiError('AI 未配置');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let full = '';

  try {
    const res = await fetch(`${BASE_URL()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY()}`,
      },
      body: JSON.stringify({
        model: opts.model ?? MODELS.main(),
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: Math.max(opts.maxTokens ?? DEFAULT_MAX_TOKENS, DEFAULT_MAX_TOKENS),
        stream: true,
      }),
      signal: ctl.signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new AiError(`AI 流式请求失败 ${res.status}: ${detail.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let thinkingSent = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 以空行分隔事件；最后一段可能不完整，留在 buffer 里
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const delta = JSON.parse(payload)?.choices?.[0]?.delta;
          if (delta?.reasoning_content && !thinkingSent) {
            thinkingSent = true;
            yield { type: 'thinking' };
          }
          const text: string = delta?.content ?? '';
          if (text) {
            full += text;
            yield { type: 'delta', text };
          }
        } catch {
          /* 跳过畸形分片 */
        }
      }
    }

    if (!full.trim()) throw new AiError('AI 未返回内容');
    yield { type: 'done', text: full };
  } catch (err) {
    if (err instanceof AiError) throw err;
    if ((err as Error).name === 'AbortError') throw new AiError('AI 请求超时');
    throw new AiError(`AI 流式调用异常: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** 从可能带 ```json 包裹或前后有解释文字的回复里提取 JSON */
export function extractJson<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    // 退一步：截取第一个 { 或 [ 到最后一个配对括号
    const start = s.search(/[{[]/);
    const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (start >= 0 && end > start) {
      return JSON.parse(s.slice(start, end + 1)) as T;
    }
    throw new AiError(`无法解析 AI 返回的 JSON: ${raw.slice(0, 200)}`);
  }
}

/** 结构化输出：要求模型只吐 JSON，并做一次解析兜底 */
export async function chatJson<T>(messages: ChatMessage[], opts: ChatOptions = {}): Promise<T> {
  const raw = await chat(messages, { ...opts, json: true, temperature: opts.temperature ?? 0.4 });
  return extractJson<T>(raw);
}

/**
 * 文生图端点。
 *
 * 这套服务上 OpenAI 兼容的 /images/generations 与原生 text2image 都回
 * "url error, please check url"，异步提交也被拒（AccessDenied: current user api
 * does not support asynchronous calls）。实测唯一可用的是多模态生成端点，
 * 同步返回图片链接，一次约 15 秒。
 */
const IMAGE_URL = () =>
  process.env.AI_IMAGE_URL ||
  `${BASE_URL().replace(/\/compatible-mode\/v1$/, '')}/api/v1/services/aigc/multimodal-generation/generation`;

/**
 * 文生图。返回的链接来自对象存储且**只有 23 小时有效期**，
 * 调用方必须自己落地保存，不能直接存库当长期地址（见 insights.getSceneImage）。
 *
 * 没配模型返回 null（上层据此给出"未配置"的提示）；配了却失败则抛出带原因的
 * AiError —— 原来一律吞成 null，界面只能含糊地说"未配置或失败"，没法排查。
 */
export async function generateImage(prompt: string): Promise<string | null> {
  const model = MODELS.image();
  if (!model || !aiConfigured()) return null;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 180_000);
  try {
    const res = await fetch(IMAGE_URL(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY()}`,
      },
      body: JSON.stringify({
        model,
        input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
        parameters: { size: '1024*1024', n: 1 },
      }),
      signal: ctl.signal,
    });

    const text = await res.text();
    if (!res.ok) throw new AiError(`文生图失败（HTTP ${res.status}）：${text.slice(0, 200)}`);

    const data = JSON.parse(text) as {
      output?: { choices?: { message?: { content?: { image?: string }[] } }[] };
    };
    const url = data.output?.choices?.[0]?.message?.content?.find((c) => c?.image)?.image;
    if (!url) throw new AiError(`文生图没有返回图片：${text.slice(0, 200)}`);
    return url;
  } catch (err) {
    if (err instanceof AiError) throw err;
    const msg = (err as Error).name === 'AbortError' ? '超过 180 秒未出图' : (err as Error).message;
    throw new AiError(`文生图请求失败：${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 语音识别可以指向另一套服务。
 *
 * 当前主服务（tokenplan）没有语音识别能力：/audio/transcriptions 回
 * "Model not exist"，HTTP 传音频只回一个空壳 {"status_message":"Success."}，
 * realtime 的 WebSocket 端点也连不上。所以单独留出这三项，
 * 不填则沿用主服务的地址与 key。
 */
const ASR_BASE_URL = () =>
  (process.env.AI_ASR_BASE_URL || process.env.AI_BASE_URL || '').replace(/\/$/, '');
const ASR_API_KEY = () => process.env.AI_ASR_API_KEY || process.env.AI_API_KEY || '';
// 不回落到主服务的音频模型：它那两个音频模型都不能转写，
// 回落过去只会让人收到一句莫名的 "Model not exist"
const ASR_MODEL = () => process.env.AI_ASR_MODEL || '';

export function asrConfigured(): boolean {
  return Boolean(ASR_BASE_URL() && ASR_API_KEY() && ASR_MODEL());
}

/**
 * 语音转文字（OpenAI 兼容的 /audio/transcriptions）。
 *
 * 失败一律抛错，不再返回 null：录音已经不留音频文件了，转写是唯一的留存方式，
 * 悄悄失败等于把人说的话丢掉。让调用方把原因显示出来，用户可以当场重说。
 */
export async function transcribe(file: Blob, filename = 'note.webm'): Promise<string> {
  if (!asrConfigured()) {
    throw new AiError('未配置语音识别模型，请在 .env.local 设置 AI_ASR_MODEL（必要时加 AI_ASR_BASE_URL / AI_ASR_API_KEY）');
  }

  const form = new FormData();
  form.append('file', file, filename);
  form.append('model', ASR_MODEL());
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120_000);
  try {
    const res = await fetch(`${ASR_BASE_URL()}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ASR_API_KEY()}` },
      body: form,
      signal: ctl.signal,
    });
    const raw = await res.text();
    if (!res.ok) throw new AiError(`转写失败（HTTP ${res.status}）：${raw.slice(0, 200)}`);

    const data = JSON.parse(raw) as { text?: string; output?: { text?: string } };
    const text = (data.text ?? data.output?.text ?? '').trim();
    if (!text) throw new AiError('没有识别到内容，请靠近话筒再说一次');
    return text;
  } catch (err) {
    if (err instanceof AiError) throw err;
    const e = err as Error;
    throw new AiError(e.name === 'AbortError' ? '转写超时（超过 120 秒）' : `转写请求失败：${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}
