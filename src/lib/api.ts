import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError } from './auth';
import { AiError } from './ai';

/** 统一包装路由处理器：集中处理鉴权错误、校验错误与 AI 异常 */
export function handler<T>(fn: () => Promise<T>) {
  return fn()
    .then((data) => NextResponse.json(data ?? { ok: true }))
    .catch((err: unknown) => {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: err.errors[0]?.message ?? '参数不正确' },
          { status: 400 },
        );
      }
      if (err instanceof AiError) {
        return NextResponse.json({ error: err.message, ai: true }, { status: 503 });
      }
      console.error('[api]', err);
      return NextResponse.json({ error: (err as Error).message || '服务异常' }, { status: 500 });
    });
}

export function bad(message: string): never {
  throw new HttpError(400, message);
}

export function notFound(message = '未找到'): never {
  throw new HttpError(404, message);
}

/** 解析并校验请求体 */
export async function body<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    bad('请求体不是合法 JSON');
  }
  return schema.parse(json);
}

/** 从查询串取整数 */
export function intParam(req: Request, name: string, fallback?: number): number {
  const v = new URL(req.url).searchParams.get(name);
  if (v === null || v === '') {
    if (fallback === undefined) bad(`缺少参数 ${name}`);
    return fallback;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) bad(`参数 ${name} 不是数字`);
  return Math.trunc(n);
}
