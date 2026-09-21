'use client';

import Link from 'next/link';
import { IconAdmin, IconChevronRight, IconTile } from '@/components/Ui';
import { useAdminPending } from './AdminPendingProvider';

export default function AdminMeLink() {
  const { pending } = useAdminPending();

  return (
    <li>
      <Link href="/admin" className="card relative flex items-center gap-3 px-4 py-3.5 active:bg-brand-50">
        <IconTile tone="accent">
          <IconAdmin size={20} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-accent">管理后台</p>
          <p className="mt-0.5 text-xs font-medium text-muted">审批申请 · 分配密码 · 讲道资源</p>
        </div>
        {pending > 0 && (
          <span
            className="absolute right-10 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent ring-2 ring-card"
            aria-hidden
          />
        )}
        <IconChevronRight className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}
