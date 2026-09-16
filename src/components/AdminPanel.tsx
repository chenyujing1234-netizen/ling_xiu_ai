'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';

type Request = {
  id: number;
  phone: string;
  name: string;
  church: string | null;
  note: string | null;
  status: string;
  created_at: string;
  reject_reason: string | null;
};

type User = {
  id: number;
  phone: string;
  name: string;
  role: string;
  status: string;
  church: string | null;
  must_change_pw: number;
  last_login_at: string | null;
  devotions: number;
  notes: number;
  last_read: string | null;
};

type Resource = {
  id: number;
  title: string;
  speaker: string | null;
  source: string | null;
  url: string;
  book_id: number;
  book_name?: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  start_sec: number | null;
  note: string | null;
};

type BookBrief = { id: number; name: string; chapters: number };
type Tab = 'requests' | 'users' | 'resources';

export default function AdminPanel({ books }: { books: BookBrief[] }) {
  const [tab, setTab] = useState<Tab>('requests');
  const [error, setError] = useState('');
  /** 生成的密码只在响应里出现一次，这里暂存以便管理员抄给用户 */
  const [credential, setCredential] = useState<{ name: string; phone: string; password: string } | null>(null);

  return (
    <div className="px-4 py-5">
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold">管理后台</h1>
        <div className="mt-3 flex gap-2">
          {(
            [
              ['requests', '使用申请'],
              ['users', '成员'],
              ['resources', '讲道资源'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                tab === key ? 'bg-brand-500 text-white' : 'border border-line text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="mb-3 rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>}

      {credential && (
        <div className="card mb-4 border-brand-300 bg-brand-50 px-4 py-4">
          <p className="label mb-1.5">请把这个密码线下告诉他（只显示这一次）</p>
          <p className="text-[15px]">
            {credential.name} · {credential.phone}
          </p>
          <p className="my-2 select-all rounded-xl bg-card px-3.5 py-3 font-mono text-[22px] tracking-wider text-brand-700">
            {credential.password}
          </p>
          <p className="text-xs leading-relaxed text-muted">
            他首次登录后会被要求立即修改密码。关掉这个提示就再也看不到明文了。
          </p>
          <button className="btn-ghost mt-2.5 w-full" onClick={() => setCredential(null)}>
            我已记下，关闭
          </button>
        </div>
      )}

      {tab === 'requests' && <RequestsTab onError={setError} onCredential={setCredential} />}
      {tab === 'users' && <UsersTab onError={setError} onCredential={setCredential} />}
      {tab === 'resources' && <ResourcesTab books={books} onError={setError} />}
    </div>
  );
}

// ---------- 使用申请 ----------

function RequestsTab({
  onError,
  onCredential,
}: {
  onError: (m: string) => void;
  onCredential: (c: { name: string; phone: string; password: string }) => void;
}) {
  const [items, setItems] = useState<Request[] | null>(null);
  const [busy, setBusy] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await api<{ requests: Request[] }>('/api/admin/requests');
      setItems(res.requests);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(id: number, action: 'approve' | 'reject') {
    setBusy(id);
    onError('');
    try {
      const res = await api<{ password?: string; name?: string; phone?: string }>(
        '/api/admin/requests',
        { json: { id, action } },
      );
      if (res.password) {
        onCredential({ name: res.name ?? '', phone: res.phone ?? '', password: res.password });
      }
      await load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(0);
    }
  }

  if (!items) return <p className="py-10 text-center text-sm text-muted">加载中…</p>;

  const pending = items.filter((i) => i.status === 'pending');
  const handled = items.filter((i) => i.status !== 'pending');

  return (
    <div className="space-y-5">
      <section>
        <h2 className="label mb-2">待审批（{pending.length}）</h2>
        {pending.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-muted">没有待审批的申请</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="card px-4 py-3.5">
                <p className="text-[15px] font-medium">
                  {r.name} · {r.phone}
                </p>
                {r.church && <p className="mt-0.5 text-xs text-muted">{r.church}</p>}
                {r.note && <p className="mt-1.5 text-[13px] leading-relaxed text-ink/85">{r.note}</p>}
                <p className="mt-1 text-[11px] text-muted">{r.created_at}</p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    className="btn-primary flex-1 py-2"
                    disabled={busy === r.id}
                    onClick={() => review(r.id, 'approve')}
                  >
                    {busy === r.id ? '处理中…' : '通过并分配密码'}
                  </button>
                  <button
                    className="btn-ghost px-3 py-2 text-accent"
                    disabled={busy === r.id}
                    onClick={() => review(r.id, 'reject')}
                  >
                    拒绝
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {handled.length > 0 && (
        <section>
          <h2 className="label mb-2">已处理</h2>
          <ul className="space-y-1.5">
            {handled.map((r) => (
              <li key={r.id} className="card flex items-center justify-between px-4 py-2.5">
                <span className="text-[14px]">
                  {r.name} · {r.phone}
                </span>
                <span className={`text-xs ${r.status === 'approved' ? 'text-brand-500' : 'text-muted'}`}>
                  {r.status === 'approved' ? '已通过' : '已拒绝'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------- 成员 ----------

function UsersTab({
  onError,
  onCredential,
}: {
  onError: (m: string) => void;
  onCredential: (c: { name: string; phone: string; password: string }) => void;
}) {
  const [items, setItems] = useState<User[] | null>(null);
  const [busy, setBusy] = useState(0);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ users: User[] }>('/api/admin/users')).users);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(u: User, action: string) {
    setBusy(u.id);
    onError('');
    try {
      const res = await api<{ password?: string }>('/api/admin/users', { json: { id: u.id, action } });
      if (res.password) onCredential({ name: u.name, phone: u.phone, password: res.password });
      await load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(0);
    }
  }

  if (!items) return <p className="py-10 text-center text-sm text-muted">加载中…</p>;

  return (
    <ul className="space-y-2">
      {items.map((u) => (
        <li key={u.id} className="card px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-medium">
              {u.name}
              {u.role === 'admin' && <span className="ml-1.5 chip">管理员</span>}
              {u.status !== 'active' && <span className="ml-1.5 text-xs text-accent">已停用</span>}
            </p>
            <span className="text-xs text-muted">{u.phone}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            完成灵修 {u.devotions} 次 · 笔记 {u.notes} 条 ·{' '}
            {u.last_read ? `最近读经 ${u.last_read}` : '还没读过'}
            {u.must_change_pw ? ' · 待改初始密码' : ''}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              className="btn-ghost px-2.5 py-1.5 text-xs"
              disabled={busy === u.id}
              onClick={() => act(u, 'resetPassword')}
            >
              重置密码
            </button>
            {u.status === 'active' ? (
              <button
                className="btn-ghost px-2.5 py-1.5 text-xs text-accent"
                disabled={busy === u.id}
                onClick={() => act(u, 'disable')}
              >
                停用
              </button>
            ) : (
              <button
                className="btn-ghost px-2.5 py-1.5 text-xs"
                disabled={busy === u.id}
                onClick={() => act(u, 'enable')}
              >
                恢复
              </button>
            )}
            {u.role === 'admin' ? (
              <button
                className="btn-ghost px-2.5 py-1.5 text-xs"
                disabled={busy === u.id}
                onClick={() => act(u, 'demote')}
              >
                取消管理员
              </button>
            ) : (
              <button
                className="btn-ghost px-2.5 py-1.5 text-xs"
                disabled={busy === u.id}
                onClick={() => act(u, 'promote')}
              >
                设为管理员
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- 讲道资源 ----------

const EMPTY_FORM = {
  title: '',
  url: '',
  speaker: '',
  source: '福音影视网',
  bookId: 1,
  chapter: 1,
  verseStart: 1,
  verseEnd: 0,
  startSec: '',
  note: '',
};

function ResourcesTab({ books, onError }: { books: BookBrief[]; onError: (m: string) => void }) {
  const [items, setItems] = useState<Resource[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ resources: Resource[] }>('/api/resources')).resources);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const book = books.find((b) => b.id === form.bookId);

  async function submit() {
    setBusy(true);
    onError('');
    try {
      await api('/api/resources', {
        json: {
          ...form,
          startSec: form.startSec ? Number(form.startSec) : null,
          speaker: form.speaker || undefined,
          source: form.source || undefined,
          note: form.note || undefined,
        },
      });
      setForm({ ...EMPTY_FORM, bookId: form.bookId, chapter: form.chapter, source: form.source });
      await load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    try {
      await api(`/api/resources?id=${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card px-4 py-4">
        <p className="label mb-2.5">添加讲道视频 / 解经资源</p>
        <div className="space-y-2">
          <input
            className="field"
            placeholder="标题，如「创世记第一讲：起初神创造」"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            className="field"
            placeholder="链接（https://…）"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              className="field flex-1"
              placeholder="讲员"
              value={form.speaker}
              onChange={(e) => setForm({ ...form, speaker: e.target.value })}
            />
            <input
              className="field flex-1"
              placeholder="来源"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="field flex-1"
              value={form.bookId}
              onChange={(e) => setForm({ ...form, bookId: Number(e.target.value), chapter: 1 })}
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              className="field w-24"
              value={form.chapter}
              onChange={(e) => setForm({ ...form, chapter: Number(e.target.value) })}
            >
              {Array.from({ length: book?.chapters ?? 1 }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>
                  {c} 章
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              className="field flex-1"
              type="number"
              min={1}
              placeholder="起始节"
              value={form.verseStart}
              onChange={(e) => setForm({ ...form, verseStart: Number(e.target.value) })}
            />
            <input
              className="field flex-1"
              type="number"
              min={0}
              placeholder="结束节（0=整章）"
              value={form.verseEnd}
              onChange={(e) => setForm({ ...form, verseEnd: Number(e.target.value) })}
            />
            <input
              className="field flex-1"
              type="number"
              min={0}
              placeholder="片段起点（秒）"
              value={form.startSec}
              onChange={(e) => setForm({ ...form, startSec: e.target.value })}
            />
          </div>
          <input
            className="field"
            placeholder="备注（选填）"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <button
            className="btn-primary w-full py-2.5"
            disabled={busy || !form.title.trim() || !form.url.trim()}
            onClick={submit}
          >
            {busy ? '添加中…' : '添加资源'}
          </button>
          <p className="text-xs leading-relaxed text-muted">
            填了「片段起点」后，读经页的链接会自动带上时间参数，
            点进去直接从讲这节的位置开始播。
          </p>
        </div>
      </section>

      <section>
        <h2 className="label mb-2">已有资源（{items?.length ?? 0}）</h2>
        {!items ? (
          <p className="py-6 text-center text-sm text-muted">加载中…</p>
        ) : items.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-muted">还没有添加任何资源</p>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li key={r.id} className="card px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.book_name ?? ''} {r.chapter}章
                      {r.verse_start ? `:${r.verse_start}` : ''}
                      {r.verse_end && r.verse_end !== r.verse_start ? `-${r.verse_end}` : ''}
                      {r.speaker ? ` · ${r.speaker}` : ''}
                      {r.start_sec ? ` · 从 ${r.start_sec}s` : ''}
                    </p>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-[11px] text-brand-500"
                    >
                      {r.url}
                    </a>
                  </div>
                  <button className="shrink-0 text-xs text-accent" onClick={() => remove(r.id)}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
