import { Suspense } from 'react';
import Link from 'next/link';
import AuthHeroImage from '@/components/AuthHeroImage';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="page-canvas flex min-h-screen flex-col px-7 pb-12 pt-0">
      <AuthHeroImage variant="login" />
      <div className="flex flex-1 flex-col justify-center">
      <header className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-xl text-white shadow-soft">
          ✦
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight">晨光</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          一天里最安静的那段时间。
          <br />
          慢一点，想深一点。
        </p>
      </header>

      {/* useSearchParams 需要 Suspense 边界 */}
      <Suspense fallback={<div className="h-[168px]" />}>
        <LoginForm />
      </Suspense>

      <div className="mt-8 space-y-3 text-center">
        <p className="text-sm text-muted">仅限受邀使用 · 首次来访请先申请</p>
        <Link
          href="/apply"
          className="inline-block text-sm font-medium text-brand-500 underline-offset-4 hover:underline"
        >
          申请使用 →
        </Link>
      </div>
      </div>
    </div>
  );
}
