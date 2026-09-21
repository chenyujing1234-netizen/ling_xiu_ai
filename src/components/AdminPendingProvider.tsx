'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/client';

type Ctx = {
  pending: number;
  refresh: () => Promise<void>;
};

const AdminPendingContext = createContext<Ctx>({ pending: 0, refresh: async () => {} });

export function useAdminPending() {
  return useContext(AdminPendingContext);
}

export default function AdminPendingProvider({
  isAdmin,
  initialPending,
  children,
}: {
  isAdmin: boolean;
  initialPending: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [pending, setPending] = useState(isAdmin ? initialPending : 0);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api<{ pending: number }>('/api/admin/pending-count');
      setPending(res.pending ?? 0);
    } catch {
      /* 网络抖动时保留上次数字 */
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setPending(initialPending);
  }, [isAdmin, initialPending]);

  useEffect(() => {
    if (!isAdmin) return;
    void refresh();
    const t = window.setInterval(refresh, 45_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isAdmin, refresh]);

  useEffect(() => {
    if (!isAdmin) return;
    void refresh();
  }, [pathname, isAdmin, refresh]);

  return (
    <AdminPendingContext.Provider value={{ pending, refresh }}>
      {children}
      {isAdmin && pending > 0 && (
        <Link
          href="/admin"
          className="fixed right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-line/90 bg-card/95 shadow-md backdrop-blur-md active:scale-95"
          style={{ top: 'max(10px, env(safe-area-inset-top, 0px))' }}
          aria-label={`${pending} 条待审批申请，前往管理后台`}
        >
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-card" aria-hidden />
          <svg className="h-[18px] w-[18px] text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
          </svg>
        </Link>
      )}
    </AdminPendingContext.Provider>
  );
}
