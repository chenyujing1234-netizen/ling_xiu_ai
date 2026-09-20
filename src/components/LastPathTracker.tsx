'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const SKIP = /^\/(login|apply)(\/|$)/;

function fullPath(pathname: string, search: string) {
  return search ? `${pathname}?${search}` : pathname;
}

function shouldTrack(path: string) {
  return path.startsWith('/') && !SKIP.test(path) && !path.startsWith('/api');
}

/** 微信 web-view 里 sendBeacon 常不带 Cookie，统一用 fetch + keepalive */
function save(path: string) {
  if (!shouldTrack(path)) return;
  void fetch('/api/me/last-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    credentials: 'same-origin',
    keepalive: true,
  });
}

/** 登录用户的路由与关页时，把当前路径写入服务端 */
export default function LastPathTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathRef = useRef('');
  const lastSent = useRef('');

  useEffect(() => {
    const path = fullPath(pathname, searchParams.toString());
    pathRef.current = path;
    if (path === lastSent.current) return;
    lastSent.current = path;
    save(path);
  }, [pathname, searchParams]);

  useEffect(() => {
    const flush = () => save(pathRef.current);
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    // 微信里 pagehide 不一定触发，定时再存一份
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') flush();
    }, 12_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
      clearInterval(timer);
    };
  }, []);

  return null;
}
