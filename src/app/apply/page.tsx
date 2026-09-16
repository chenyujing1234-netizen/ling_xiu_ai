'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';

export default function ApplyPage() {
  const [form, setForm] = useState({ name: '', phone: '', church: '', note: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setState('busy');
    try {
      await api('/api/auth/apply', { json: form });
      setState('done');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className="flex min-h-screen flex-col justify-center px-7 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl text-brand-500">
          ✓
        </div>
        <h1 className="text-xl font-semibold">申请已提交</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          管理员审批通过后，会通过微信或电话
          <br />
          把你的初始密码告知你。
        </p>
        <Link href="/login" className="btn-ghost mx-auto mt-8">
          返回登录
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-7 py-12">
      <header className="mb-8">
        <h1 className="text-[22px] font-semibold">申请使用</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          这是一个小范围使用的读经工具。留下你的信息，
          管理员确认后会把密码单独告诉你 —— 我们不发短信、不发邮件。
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3">
        <input className="field" placeholder="姓名 / 弟兄姊妹称呼" value={form.name} onChange={set('name')} required />
        <input
          className="field"
          type="tel"
          inputMode="numeric"
          placeholder="手机号（作为登录账号）"
          value={form.phone}
          onChange={set('phone')}
          required
        />
        <input className="field" placeholder="所属教会 / 小组（选填）" value={form.church} onChange={set('church')} />
        <textarea
          className="field min-h-[96px] resize-none"
          placeholder="想说的话：谁介绍你来的、目前的读经情况（选填）"
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
