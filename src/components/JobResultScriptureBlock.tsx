'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { parseScriptureRefFromJobLabel } from '@/lib/job-scripture-ref';

/** 后台任务结果：根据 label 拉取并展示经文正文 */
export default function JobResultScriptureBlock({ jobLabel }: { jobLabel: string }) {
  const parsed = useMemo(() => parseScriptureRefFromJobLabel(jobLabel), [jobLabel]);
  const [ref, setRef] = useState<string | null>(null);
  const [cn, setCn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!parsed) {
      setRef(null);
      setCn(null);
      return;
    }

    const q = new URLSearchParams({ chapter: String(parsed.chapter) });
    if (parsed.bookId) q.set('book', String(parsed.bookId));
    else if (parsed.bookName) q.set('bookName', parsed.bookName);
    else return;

    if (parsed.from) {
      q.set('from', String(parsed.from));
      q.set('to', String(parsed.to ?? parsed.from));
    }

    let alive = true;
    setLoading(true);
    api<{ ref: string; cn: string }>(`/api/bible/snippet?${q}`)
      .then((res) => {
        if (!alive) return;
        setRef(res.ref);
        setCn(res.cn);
      })
      .catch(() => {
        if (!alive) return;
        setRef(null);
        setCn(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [parsed]);

  if (!parsed) return null;
  if (loading && !cn) {
    return <p className="mb-3 text-center text-xs text-muted">加载经文…</p>;
  }
  if (!cn) return null;

  return (
    <div className="mb-4 rounded-xl border border-line bg-brand-50/50 px-3 py-2.5">
      <p className="text-[11px] font-bold text-brand-700">{ref ?? jobLabel}</p>
      <p className="scripture mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink/90">{cn}</p>
    </div>
  );
}
