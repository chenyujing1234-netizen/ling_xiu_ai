'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { useBindOverlayHistory } from '@/lib/overlay-history';

type Step = {
  targetId: string;
  title: string;
  body: string;
  /** 展示本步前执行（如切换页签） */
  prepare?: () => void;
};

export type SpotlightStep = Step;

const PAD = 10;
const TOOLTIP_GAP = 12;

function measure(id: string): DOMRect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  el.scrollIntoView({ block: 'nearest', behavior: 'instant' in window ? ('instant' as ScrollBehavior) : 'auto' });
  return el.getBoundingClientRect();
}

export default function DevotionSpotlightTour({
  show,
  unlockScore,
  steps: stepsProp,
  onFinish,
}: {
  show: boolean;
  unlockScore: number;
  /** 自定义引导步骤（如灵修流程页）；缺省为灵修列表页的四步 */
  steps?: Step[];
  /** 引导结束/跳过后回调（如流程页切回「灵修」页签） */
  onFinish?: () => void;
}) {
  const [open, setOpen] = useState(show);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const finishingRef = useRef(false);

  const listSteps = useMemo<Step[]>(
    () => [
      {
        targetId: 'lx-tour-tab-devotion',
        title: '我的灵修',
        body: '这一页记录你进行中和已完成的灵修。走完七步（观察→提问→默想→引导→实事→祷告）才算真正读过一章。',
      },
      {
        targetId: 'lx-tour-devotion-start',
        title: '从这里开始',
        body: `点这里进入今天的灵修流程。前几步认真写满后，评估达到 ${unlockScore} 分才会解锁「引导」；避免还没想过就给你标准答案。`,
      },
      {
        targetId: 'lx-tour-tab-explore',
        title: '经文资料',
        prepare: () => document.getElementById('lx-tour-tab-explore')?.click(),
        body: '第二个页签：按书卷查要素梳理、知识图谱、思维导图、意境配图与讲道链接，帮助你在灵修前先熟悉这一章。',
      },
      {
        targetId: 'lx-tour-explore-header',
        title: '选书选章',
        prepare: () => document.getElementById('lx-tour-tab-explore')?.click(),
        body: '在这里切换经卷与章，也可以看整章的「圣经背景」。进入灵修后，经节旁还有「注释」「配图」；长按经节可记笔记。',
      },
    ],
    [unlockScore],
  );

  const steps = stepsProp ?? listSteps;

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setOpen(false);
    try {
      await api('/api/me/onboarding', { method: 'POST' });
    } catch {
      /* 下次可再显示 */
    }
    onFinish?.();
  }, [onFinish]);

  useEffect(() => {
    setOpen(show);
  }, [show]);

  const updateRect = useCallback(() => {
    const s = steps[step];
    if (!s) return;
    s.prepare?.();
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        setRect(measure(s.targetId));
      }, s.prepare ? 120 : 0);
    });
  }, [step, steps]);

  useLayoutEffect(() => {
    if (!open) return;
    updateRect();
  }, [open, step, updateRect]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updateRect();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, updateRect]);

  useBindOverlayHistory(open, () => {
    void finish();
  });

  if (!open) return null;

  const current = steps[step];
  const isLast = step >= steps.length - 1;

  const hole =
    rect &&
    ({
      top: Math.max(8, rect.top - PAD),
      left: Math.max(8, rect.left - PAD),
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    } as const);

  const tooltipTop = hole
    ? Math.min(hole.top + hole.height + TOOLTIP_GAP, window.innerHeight - 200)
    : '50%';

  return (
    <div className="fixed inset-0 z-[235]" role="dialog" aria-modal="true" aria-labelledby="lx-devotion-tour-title">
      {/* 蒙层：挖洞靠超大 box-shadow */}
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-brand-400 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.58)]"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" aria-hidden />
      )}

      <div
        className="pointer-events-auto absolute inset-x-4 z-[236] mx-auto max-w-md rounded-2xl border border-line bg-card px-4 py-4 shadow-sheet"
        style={{ top: typeof tooltipTop === 'number' ? tooltipTop : undefined }}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">
          使用指引 · {step + 1}/{steps.length}
        </p>
        <h2 id="lx-devotion-tour-title" className="mt-1 text-[17px] font-bold text-brand-700">
          {current?.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{current?.body}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-ghost flex-1 py-2.5 text-sm" onClick={() => void finish()}>
            跳过
          </button>
          <button
            type="button"
            className="btn-primary flex-1 py-2.5 text-sm"
            onClick={() => {
              if (isLast) void finish();
              else setStep((n) => n + 1);
            }}
          >
            {isLast ? '开始使用' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}
