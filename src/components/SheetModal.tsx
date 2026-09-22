'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SheetCloseButton } from '@/components/Ui';

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
}: {
  onClose: () => void;
  children: ReactNode;
  zBackdrop?: number;
  zSheet?: number;
  className?: string;
  closeDisabled?: boolean;
}) {
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
      <div className={`sheet max-h-[88vh] overflow-hidden ${className}`} style={{ zIndex: zSheet }}>
        <div className="relative max-h-[inherit] overflow-y-auto no-bar">
          <SheetCloseButton onClick={onClose} disabled={closeDisabled} />
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
