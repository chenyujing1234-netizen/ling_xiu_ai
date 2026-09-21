'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { backFallbackFor, shouldShowPageBack } from '@/lib/nav-back';
import PageBackButton from './PageBackButton';

export default function SubpageBackBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!shouldShowPageBack(pathname)) return null;
  if (pathname === '/me/password' && searchParams.get('first') === '1') return null;

  return (
    <div className="sticky top-0 z-40 mb-3 border-b border-line/80 bg-paper/95 px-4 py-2 backdrop-blur-md">
      <PageBackButton fallback={backFallbackFor(pathname)} />
    </div>
  );
}
