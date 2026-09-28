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
  zBackdrop = 80,
  zSheet = 90,
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
        className={`sheet overflow-hidden ${fullScreen ? 'sheet-fullscreen' : 'max-h-[88vh]'} ${className}`}
        style={{ zIndex: zSheet }}
      >
        <div className="relative max-h-[inherit] overflow-y-auto no-bar">
          {fullScreen && (
            <SheetBackButton onClick={onClose} disabled={closeDisabled} />
          )}
          <SheetCloseButton onClick={onClose} disabled={closeDisabled} />
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
