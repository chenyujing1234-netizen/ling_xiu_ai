'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SheetBackButton, SheetCloseButton } from '@/components/Ui';
import { useBindOverlayHistory } from '@/lib/overlay-history';

/**
 * 底部弹层挂到 body，避免被父级 overflow/transform 裁切（微信里长按笔记曾因此「看不见面板」）。
 */
export default function SheetModal({
  onClose,
  children,
  zBackdrop = 210,
  zSheet = 220,
  className = '',
  closeDisabled,
  fullScreen = false,
}: {
  onClose: () => void;
  children: ReactNode;
  zBackdrop?: number;
  zSheet?: number;
  className?: string;
  closeDisabled?: boolean;
  /** 铺满视口时在左上角显示「返回」（与关闭同效） */
  fullScreen?: boolean;
}) {
  useBindOverlayHistory(true, onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 fade-in bg-ink/35"
        style={{ zIndex: zBackdrop }}
        onClick={() => !closeDisabled && onClose()}
        aria-hidden
      />
      <div
        className={`sheet flex flex-col overflow-hidden ${fullScreen ? 'sheet-fullscreen' : 'max-h-[88vh]'} ${className}`}
        style={{ zIndex: zSheet }}
      >
        {fullScreen ? (
          <>
            <div
              className="relative z-40 flex shrink-0 items-center justify-between gap-3 border-b border-line/60 bg-card px-3 pb-2.5"
              style={{ paddingTop: 'calc(var(--safe-t, 0px) + 8px)' }}
            >
              <SheetBackButton
                onClick={onClose}
                disabled={closeDisabled}
                className="!static shrink-0"
              />
              <button
                type="button"
                onClick={onClose}
                disabled={closeDisabled}
                aria-label="关闭"
                className="shrink-0 rounded-full border border-line/90 bg-card/95 px-4 py-2 text-[13px] font-semibold text-brand-700 shadow-soft active:bg-brand-50 disabled:opacity-50"
              >
                关闭
              </button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-y-auto no-bar">{children}</div>
          </>
        ) : (
          <div className="relative max-h-[inherit] min-h-0 flex-1 overflow-y-auto no-bar">
            {/* 关闭钉在顶部，避免长内容滚动后找不到退出（手机端常见） */}
            <div
              className="sticky top-0 z-30 h-0 w-full overflow-visible"
              style={{ marginBottom: 'calc(var(--safe-t, 0px) + 44px)' }}
            >
              <SheetCloseButton onClick={onClose} disabled={closeDisabled} />
            </div>
            {children}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
