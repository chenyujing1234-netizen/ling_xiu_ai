'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<{ mustChangePw: boolean }>('/api/auth/login', {
        json: { phone, password },
      });
      const next = params.get('next');
      router.replace(res.mustChangePw ? '/me/password?first=1' : next || '/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className="field"
        type="tel"
        inputMode="numeric"
        autoComplete="username"
        placeholder="手机号"
        value={phone}
        onChange={(e) => setPhone(e.target.value.trim())}
        required
      />
      <input
        className="field"
        type="password"
        autoComplete="current-password"
        placeholder="密码（由管理员分配）"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && <p className="rounded-xl bg-accent/10 px-3.5 py-2.5 text-sm text-accent">{error}</p>}

      <button className="btn-primary w-full py-3" disabled={busy}>
        {busy ? '登录中…' : '登录'}
      </button>
    </form>
  );
}
