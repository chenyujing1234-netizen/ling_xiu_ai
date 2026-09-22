'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { STAGES, STAGE_META } from '@/lib/devotion-stages';
import { api } from '@/lib/client';
import { IconFlame, SheetCloseButton } from '@/components/Ui';

const DEVOTION_STAGES = STAGES.filter((s) => s !== 'done');

export default function OnboardingGuide({
  show,
  unlockScore,
}: {
  show: boolean;
  unlockScore: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(show);

  const onPasswordFirst = pathname === '/me/password';

  useEffect(() => {
    setOpen(show && !onPasswordFirst);
  }, [show, onPasswordFirst]);

  const dismiss = useCallback(async () => {
    setOpen(false);
    try {
      await api('/api/me/onboarding', { method: 'POST' });
    } catch {
      /* 下次进来再提示也行 */
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="card relative max-h-[min(88vh,640px)] w-full max-w-lg overflow-y-auto px-5 py-5 pr-12 shadow-sheet">
        <SheetCloseButton onClick={() => void dismiss()} />
        <h2 id="onboarding-title" className="text-[20px] font-bold text-brand-700">
          欢迎来到晨光
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          这里不是「划完进度条」，而是留一段安静时间，与经文和神相遇。下面用最要紧的一件事说起——
          <span className="font-semibold text-ink">「灵修」</span>
          怎么走。
        </p>

        <section className="mt-4 rounded-xl border border-brand-200/80 bg-brand-50/80 px-4 py-3.5">
          <div className="mb-2 flex items-center gap-2 text-brand-700">
            <IconFlame size={18} />
            <h3 className="text-[15px] font-bold">灵修：七步走完才算一次</h3>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            从底部 <span className="font-medium text-ink">「灵修」</span> Tab，或首页{' '}
            <span className="font-medium text-ink">「开始今天的灵修」</span> 进入。每一章走完整条链路，才算真正读过。
          </p>
          <ol className="mt-3 space-y-2.5">
            {DEVOTION_STAGES.map((key, i) => {
              const m = STAGE_META[key];
              const isGuide = key === 'guided';
              return (
                <li key={key} className="flex gap-2.5 text-[13px] leading-snug">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-bold text-ink">{m.title}</p>
                    <p className="mt-0.5 text-muted">{m.hint}</p>
                    {isGuide && (
                      <p className="mt-1 text-xs font-medium text-brand-600">
                        前几步认真写满后，评估达到 {unlockScore} 分才会解锁；避免还没想过就给你标准答案。
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mt-4 space-y-2 text-[13px] leading-relaxed text-muted">
          <p>
            <span className="font-semibold text-ink">今日</span>：看每日读经计划与进度；横幅会提醒你——先自己想，再遇见引导。
          </p>
          <p>
            <span className="font-semibold text-ink">经文资料</span>：在灵修页第二个页签，查背景与注释；按住经节可记笔记。
          </p>
          <p>
            <span className="font-semibold text-ink">我的</span>：笔记、灵修记录、外观与字号都在这里调。
          </p>
        </section>

        <div className="mt-5 flex flex-col gap-2">
          <Link href="/devotion" className="btn-primary w-full gap-2 py-3" onClick={() => void dismiss()}>
            <IconFlame size={18} />
            去灵修页看看
          </Link>
          <button type="button" className="btn-ghost w-full py-2.5" onClick={() => void dismiss()}>
            我知道了，开始使用
          </button>
        </div>
      </div>
    </div>
  );
}
