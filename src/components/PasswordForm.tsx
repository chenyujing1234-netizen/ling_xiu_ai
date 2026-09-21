'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, hardNavigate } from '@/lib/client';

export default function PasswordForm() {
  const first = useSearchParams().get('first') === '1';

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('两次输入的新密码不一致');
      return;
    }
    setBusy(true);
    try {
      await api('/api/auth/password', {
        json: first ? { next } : { current, next },
      });
      setDone(true);
      setTimeout(() => hardNavigate('/'), 900);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="py-16 text-center">
        <p className="mb-2 text-3xl">✓</p>
        <p className="text-[15px]">密码已修改，正在进入…</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-[22px] font-semibold">{first ? '请先设置你的密码' : '修改密码'}</h1>
      <p className="mb-5 mt-1.5 text-sm leading-relaxed text-muted">
        {first
          ? '你刚用初始密码登录成功。请在这里设置一个只有你知道的新密码。'
          : '修改后当前设备会继续保持登录。'}
      </p>

      <form onSubmit={submit} className="space-y-3">
        {!first && (
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            placeholder="当前密码"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        )}
        <input
          className="field"
          type="password"
          autoComplete="new-password"
          placeholder="新密码（至少 6 位）"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={6}
        />
        <input
          className="field"
          type="password"
          autoComplete="new-password"
          placeholder="再输入一次新密码"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        {error && <p className="rounded-xl bg-accent/10 px-3.5 py-2.5 text-sm text-accent">{error}</p>}

        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? '提交中…' : first ? '确认设置' : '确认修改'}
        </button>
      </form>
    </>
  );
}
