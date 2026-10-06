'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const HOME_EXIT_STATE = { lxHomeExit: 1 as const };

/**
 * 首页（今日 Tab）：系统/手机返回先二次确认，避免误触退出。
 * 与浮层 history（lxOverlay）配合：关浮层后的 pop 仍带 lxHomeExit，不会误弹退出框。
 */
export default function HomeExitConfirm() {
  const pathname = usePathname();
  const active = pathname === '/';
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const pushedRef = useRef(false);
  const allowLeaveRef = useRef(false);

  const armTrap = useCallback(() => {
    if (!active || allowLeaveRef.current) return;
    if (history.state?.lxHomeExit === 1) return;
    pushedRef.current = true;
    history.pushState(HOME_EXIT_STATE, '');
  }, [active]);

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
      if (window.location.pathname !== '/') return;

      if (history.state?.lxHomeExit === 1) {
        return;
      }

      if (openRef.current) {
        setOpen(false);
        history.pushState(HOME_EXIT_STATE, '');
        return;
      }

      history.pushState(HOME_EXIT_STATE, '');
      setOpen(true);
    };

    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (pushedRef.current && !allowLeaveRef.current) {
        pushedRef.current = false;
        window.setTimeout(() => {
          if (history.state?.lxHomeExit === 1) history.back();
        }, 0);
      }
    };
  }, [active, armTrap]);

  const cancel = useCallback(() => {
    setOpen(false);
  }, []);

  const confirmLeave = useCallback(() => {
    allowLeaveRef.current = true;
    setOpen(false);
    history.back();
  }, []);

  if (!active || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 p-6 fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="home-exit-title"
      aria-describedby="home-exit-desc"
    >
      <div className="card w-full max-w-sm px-5 py-5 shadow-sheet">
        <h2 id="home-exit-title" className="text-[17px] font-bold text-brand-700">
          要离开晨光吗？
        </h2>
        <p id="home-exit-desc" className="mt-2 text-sm leading-relaxed text-muted">
          再按一次返回将离开当前页面。若只是想切换功能，请用底部 Tab。
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={cancel}
            className="flex-1 rounded-xl border border-line bg-card py-3 text-[15px] font-semibold text-ink active:bg-brand-50"
          >
            留下
          </button>
          <button
            type="button"
            onClick={confirmLeave}
            className="flex-1 rounded-xl bg-brand-600 py-3 text-[15px] font-bold text-white shadow-glow active:opacity-90"
          >
            离开
          </button>
        </div>
      </div>
    </div>
  );
}
