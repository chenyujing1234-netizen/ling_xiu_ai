'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AuthHeroImage from '@/components/AuthHeroImage';
import { api } from '@/lib/client';

const PHONE_RE = /^1\d{10}$/;

export default function ApplyPage() {
  const [form, setForm] = useState({ phone: '', password: '', smsCode: '', note: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function sendCode() {
    setError('');
    if (!PHONE_RE.test(form.phone)) {
      setError('请先填写正确的 11 位手机号');
      return;
    }
    setSending(true);
    try {
      await api('/api/auth/sms-code', { json: { phone: form.phone } });
      setCountdown(60);
      timer.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (timer.current) clearInterval(timer.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('登录密码至少 6 位');
      return;
    }
    if (!/^\d{6}$/.test(form.smsCode)) {
      setError('请填写收到的 6 位短信验证码');
      return;
    }
    setState('busy');
    try {
      await api('/api/auth/apply', {
        json: {
          phone: form.phone,
          password: form.password,
          smsCode: form.smsCode,
          note: form.note || undefined,
        },
      });
      setState('done');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className="page-canvas flex min-h-screen flex-col px-7 pb-12 pt-0 text-center">
        <AuthHeroImage variant="apply" />
        <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl text-brand-500">
          ✓
        </div>
        <h1 className="text-xl font-semibold">申请已提交</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          管理员审批通过后，用你刚设的手机号和密码
          <br />
          即可直接登录，无需再等其他密码。
        </p>
        <Link href="/login" className="btn-ghost mx-auto mt-8">
          返回登录
        </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-canvas min-h-screen px-7 pb-12 pt-0">
      <AuthHeroImage variant="apply" />
      <header className="mb-8">
        <h1 className="text-[22px] font-semibold">申请使用</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          这里只向小范围开放。留下手机号并设置登录密码，
          确认通过后即可进入 —— 密码由你在申请时设定，请牢记。
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3">
        <input
          className="field"
          type="tel"
          inputMode="numeric"
          placeholder="手机号（作为登录账号）"
          value={form.phone}
          onChange={set('phone')}
          required
        />
        <div className="flex gap-2">
          <input
            className="field flex-1"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="短信验证码"
            value={form.smsCode}
            onChange={set('smsCode')}
            required
          />
          <button
            type="button"
            className="btn-ghost shrink-0 px-4 text-sm disabled:opacity-50"
            disabled={sending || countdown > 0 || !PHONE_RE.test(form.phone)}
            onClick={sendCode}
          >
            {countdown > 0 ? `${countdown}s` : sending ? '发送中…' : '获取验证码'}
          </button>
        </div>
        <input
          className="field"
          type="text"
          autoComplete="off"
          placeholder="登录密码（至少 6 位）"
          value={form.password}
          onChange={set('password')}
          required
          minLength={6}
        />
        <textarea
          className="field min-h-[96px] resize-none"
          placeholder="想说的话：谁介绍你来的（选填）"
          value={form.note}
          onChange={set('note')}
        />

        {error && <p className="rounded-xl bg-accent/10 px-3.5 py-2.5 text-sm text-accent">{error}</p>}

        <button className="btn-primary w-full py-3" disabled={state === 'busy'}>
          {state === 'busy' ? '提交中…' : '提交申请'}
        </button>
      </form>

      <Link href="/login" className="mt-8 block text-center text-sm text-muted">
        已有账号，去登录
      </Link>
    </div>
  );
}
