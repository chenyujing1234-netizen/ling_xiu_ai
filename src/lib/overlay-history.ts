'use client';

import { useEffect, useRef } from 'react';

/**
 * 浮层/结果页占一层 history：系统或顶栏「返回」先关浮层，而不是退回首页。
 */
export function useBindOverlayHistory(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closedByPopRef = useRef(false);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    closedByPopRef.current = false;
    pushedRef.current = true;
    history.pushState({ lxOverlay: 1 }, '');

    const onPop = () => {
      closedByPopRef.current = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      if (pushedRef.current && !closedByPopRef.current) {
        pushedRef.current = false;
        // 延后 pop，避免关任务列表时误关掉紧接着 present 打开的结果层
        window.setTimeout(() => {
          if (history.state?.lxOverlay === 1) {
            history.back();
          }
        }, 0);
      } else {
        pushedRef.current = false;
      }
    };
  }, [active]);
}
