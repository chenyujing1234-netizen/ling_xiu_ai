'use client';

/** 前端统一请求：自动带 Cookie，把后端的 error 字段变成异常 */
export async function api<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    method: rest.method ?? (json ? 'POST' : 'GET'),
    headers: json
      ? { 'Content-Type': 'application/json', ...(rest.headers ?? {}) }
      : rest.headers,
    body: json ? JSON.stringify(json) : rest.body,
    credentials: 'same-origin',
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* 非 JSON 响应 */
  }

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `请求失败（${res.status}）`;
    throw new ApiError(message, res.status, (data as { ai?: boolean } | null)?.ai);
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public isAi?: boolean) {
    super(message);
  }
}
