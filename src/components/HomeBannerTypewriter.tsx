'use client';

import { useEffect, useMemo, useState } from 'react';

/** 一段文案拆成带高亮标记的字符序列，供打字机逐字输出 */
type Part = { text: string; highlight?: boolean };
type Char = { ch: string; highlight: boolean };

function toChars(parts: Part[]): Char[] {
  return parts.flatMap((p) => [...p.text].map((ch) => ({ ch, highlight: Boolean(p.highlight) })));
}

/** 首页横幅：价值主张 + 痛点，轮播打字 */
const SCRIPTS: Part[][] = [
  [
    { text: '翻完页' },
    { text: '不算读过', highlight: true },
    { text: ' —— 把「划进度」变成' },
    { text: '与神相遇', highlight: true },
    { text: '的时间' },
  ],
  [
    { text: '读完就忘、只有信息？先' },
    { text: '观察 · 提问 · 默想', highlight: true },
    { text: '，' },
    { text: '引导', highlight: true },
    { text: '才为你开启' },
  ],
  [
    { text: '不当百科灌输标准答案，留住' },
    { text: '你自己发现', highlight: true },
    { text: '的那一份' },
    { text: '亮光', highlight: true },
  ],
];

const TYPING_MS = 58;
const PAUSE_FULL_MS = 3200;
export default function HomeBannerTypewriter() {
  const lines = useMemo(() => SCRIPTS.map(toChars), []);
  const [lineIdx, setLineIdx] = useState(0);
  const [count, setCount] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  const current = lines[lineIdx] ?? [];
  const visible = current.slice(0, count);

  useEffect(() => {
    const blink = window.setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(blink);
  }, []);

  useEffect(() => {
    if (count < current.length) {
      const t = window.setTimeout(() => setCount((c) => c + 1), TYPING_MS);
      return () => clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setCount(0);
      setLineIdx((i) => (i + 1) % lines.length);
    }, PAUSE_FULL_MS);
    return () => clearTimeout(t);
  }, [count, current.length, lineIdx, lines.length]);

  return (
    <p
      className="max-w-[92%] text-center text-[16px] font-semibold leading-[1.55] text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)] sm:text-[18px]"
      aria-live="polite"
    >
      {visible.map((item, i) =>
        item.highlight ? (
          <span key={i} className="font-extrabold text-[#ffefb8]">
            {item.ch}
          </span>
        ) : (
          <span key={i}>{item.ch}</span>
        ),
      )}
      <span className={showCursor ? 'opacity-100' : 'opacity-0'} aria-hidden>
        |
      </span>
    </p>
  );
}
