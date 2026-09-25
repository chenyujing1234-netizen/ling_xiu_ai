'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';

type KbItem = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  why: string;
  enabled: boolean;
  online: boolean;
  liveName: string | null;
};

type Payload = {
  configured: boolean;
  categories: { id: string; label: string }[];
  items: KbItem[];
  enabledCount: number;
  catalogCount: number;
};

export default function AdminKnowledgeTab({ onError }: { onError: (m: string) => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [on, setOn] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api<Payload>('/api/admin/knowledge-bases');
      setData(res);
      setOn(new Set(res.items.filter((i) => i.enabled).map((i) => i.id)));
    } catch (e) {
      onError((e as Error).message);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { label: string; items: KbItem[] }>();
    for (const c of data.categories) map.set(c.id, { label: c.label, items: [] });
    map.set('other', { label: '未纳入默认检索', items: [] });
    for (const it of data.items) {
      const g = map.get(it.category) ?? map.get('other')!;
      g.items.push(it);
    }
    return [...map.entries()].filter(([, g]) => g.items.length);
  }, [data]);

  function toggle(id: string) {
    setSaved('');
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setGroup(ids: string[], enable: boolean) {
    setSaved('');
    setOn((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (enable) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function save() {
    setBusy(true);
    onError('');
    try {
      const res = await api<{ enabledCount: number }>('/api/admin/knowledge-bases', {
        method: 'PATCH',
        json: { ids: [...on] },
      });
      setSaved(`已保存：LLM 将固定检索这 ${res.enabledCount} 个知识库`);
      await load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="py-10 text-center text-sm text-muted">加载知识库…</p>;

  return (
    <div className="space-y-4">
      <div className="card px-4 py-3.5">
        <p className="text-[15px] font-bold">LLM 指定知识库</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          陪读者回答时<strong className="text-ink">固定检索下列书库</strong>
          ，不再按经文名临时挑选。能用的都列上了（排除纯商业/测试库）。关掉的不会被搜。
        </p>
        <p className="mt-2 text-xs font-medium text-brand-700">
          已选 {on.size} / 目录 {data.catalogCount}
          {data.configured ? '' : ' · 书库接口暂不可用'}
        </p>
      </div>

      {groups.map(([key, g]) => (
        <section key={key}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="label">
              {g.label}
              <span className="ml-1 font-medium text-muted">
                {g.items.filter((i) => on.has(i.id)).length}/{g.items.length}
              </span>
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-[11px]"
                onClick={() => setGroup(g.items.map((i) => i.id), true)}
              >
                全选
              </button>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-[11px]"
                onClick={() => setGroup(g.items.map((i) => i.id), false)}
              >
                全关
              </button>
            </div>
          </div>
          <ul className="space-y-1.5">
            {g.items.map((it) => (
              <li key={it.id}>
                <label className="card flex cursor-pointer items-start gap-3 px-3.5 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-brand-500"
                    checked={on.has(it.id)}
                    onChange={() => toggle(it.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-snug">{it.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">{it.why}</span>
                    {!it.online && (
                      <span className="mt-0.5 block text-[11px] text-accent">书库端暂未看到这一库</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-16 z-10 bg-paper/95 py-2 backdrop-blur">
        <button type="button" className="btn-primary w-full py-3" disabled={busy} onClick={() => void save()}>
          {busy ? '保存中…' : '保存指定知识库'}
        </button>
        {saved && <p className="mt-2 text-center text-xs font-medium text-brand-700">{saved}</p>}
      </div>
    </div>
  );
}
