import { Suspense } from 'react';
import Link from 'next/link';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center px-7 py-12">
      <header className="mb-10">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white shadow-soft">
          ✦
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight">灵修AI</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          读经不止于读过。
          <br />
          先思考，再领受。
        </p>
      </header>

      {/* useSearchParams 需要 Suspense 边界 */}
      <Suspense fallback={<div className="h-[168px]" />}>
        <LoginForm />
      </Suspense>

      <div className="mt-8 space-y-3 text-center">
        <p className="text-sm text-muted">本站不开放注册，账号由管理员逐个开通。</p>
        <Link
          href="/apply"
          className="inline-block text-sm font-medium text-brand-500 underline-offset-4 hover:underline"
        >
          申请使用 →
        </Link>
      </div>
    </div>
  );
}
