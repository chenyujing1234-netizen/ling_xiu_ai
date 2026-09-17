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

/**
 * 会话状态变化（登录 / 登出 / 改密）后的跳转，必须整页跳，不能用 router.replace()。
 *
 * App Router 的 Router Cache 会缓存 middleware 的重定向结果，而那些结果是按**旧会话**
 * 算出来的：改密前 `/` 缓存的是「跳改密页」，登录前 `/read` 缓存的是「跳登录页」。
 * 客户端导航直接复用缓存，于是刚改完密码又被送回改密页、登录后又被送回登录页。
 * 整页跳转会丢掉全部客户端缓存，让 middleware 拿新 Cookie 重新判断。
 */
export function hardNavigate(path: string) {
  // 只放行站内绝对路径：整页跳转不像 router 那样限定在内部路由，
  // 否则 /login?next=//evil.com 就成了开放重定向（`\` 会被浏览器当成 `/`）。
  const safe = /^\/(?![/\\])/.test(path) ? path : '/';
  window.location.replace(safe);
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public isAi?: boolean) {
    super(message);
  }
}
