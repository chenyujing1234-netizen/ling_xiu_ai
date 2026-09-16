import { Suspense } from 'react';
import PasswordForm from '@/components/PasswordForm';

export default function ChangePasswordPage() {
  return (
    <div className="px-4 py-5">
      <Suspense fallback={<p className="py-16 text-center text-sm text-muted">加载中…</p>}>
        <PasswordForm />
      </Suspense>
    </div>
  );
}
