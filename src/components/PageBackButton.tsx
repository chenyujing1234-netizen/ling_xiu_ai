'use client';

import { useRouter } from 'next/navigation';

export default function PageBackButton({
  fallback = '/?home=1',
  className = '',
}: {
  fallback?: string;
  className?: string;
}) {
  const router = useRouter();

  function go() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <button type="button" onClick={go} className={`btn-ghost shrink-0 px-2.5 py-1.5 text-sm ${className}`}>
      ← 返回
    </button>
  );
}
