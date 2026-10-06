'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// 每个实例用自己的 pattern 当哨兵标记：两个实例（首页/灵修页）同时挂载时，
// 卸载清理只弹回自己压入的哨兵，不会误碰另一个实例刚压入的那层
function exitState(pattern: string) {
  return { lxExitConfirm: pattern };
}

/**
 * 指定页面：系统/手机返回先二次确认，避免误触退出。
 * 与浮层 history（lxOverlay）配合：关浮层后的 pop 仍带 lxExitConfirm，不会误弹退出框。
 * pattern：pathname 正则（首页 '^/$'，灵修页 '^/devotion/\\d+'）。
 * leaveTo：确认离开后前往的路由（如灵修页回首页）；缺省 history.back()（首页返回即离开站点）。
 */
export default function ExitConfirm({
  pattern,
  title,
  desc,
  confirmLabel = '离开',
  cancelLabel = '留下',
  leaveTo,
}: {
  pattern: string;
  title: string;
  desc: string;
  confirmLabel?: string;
  cancelLabel?: string;
  leaveTo?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const active = new RegExp(pattern).test(pathname);
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const pushedRef = useRef(false);
  const allowLeaveRef = useRef(false);

  const armTrap = useCallback(() => {
    if (!active || allowLeaveRef.current) return;
    if (history.state?.lxExitConfirm === pattern) return;
    pushedRef.current = true;
    history.pushState(exitState(pattern), '');
  }, [active, pattern]);

  useEffect(() => {
    if (!active) {
      setOpen(false);
      return;
    }
    allowLeaveRef.current = false;
    pushedRef.current = false;
    armTrap();

    const onPop = () => {
      if (allowLeaveRef.current) return;
      if (!new RegExp(pattern).test(window.location.pathname)) return;

      // 关浮层（lxOverlay）后落回本页的 trap：直接吃掉，不弹确认
      if (history.state?.lxExitConfirm === pattern) {
        return;
      }

      if (openRef.current) {
        setOpen(false);
        history.pushState(exitState(pattern), '');
        return;
      }

      history.pushState(exitState(pattern), '');
      setOpen(true);
    };

    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (pushedRef.current && !allowLeaveRef.current) {
        pushedRef.current = false;
        window.setTimeout(() => {
          if (history.state?.lxExitConfirm === pattern) history.back();
        }, 0);
      }
    };
  }, [active, armTrap, pattern]);

  const cancel = useCallback(() => {
    setOpen(false);
  }, []);

  const confirmLeave = useCallback(() => {
    allowLeaveRef.current = true;
    setOpen(false);
    if (leaveTo) router.push(leaveTo);
    else history.back();
  }, [leaveTo, router]);

  if (!active || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 p-6 fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="exit-confirm-title"
      aria-describedby="exit-confirm-desc"
    >
      <div className="card w-full max-w-sm px-5 py-5 shadow-sheet">
        <h2 id="exit-confirm-title" className="text-[17px] font-bold text-brand-700">
          {title}
        </h2>
        <p id="exit-confirm-desc" className="mt-2 text-sm leading-relaxed text-muted">
          {desc}
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={cancel}
            className="flex-1 rounded-xl border border-line bg-card py-3 text-[15px] font-semibold text-ink active:bg-brand-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={confirmLeave}
            className="flex-1 rounded-xl bg-brand-600 py-3 text-[15px] font-bold text-white shadow-glow active:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
