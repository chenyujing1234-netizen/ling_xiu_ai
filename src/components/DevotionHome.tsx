'use client';

import { useState } from 'react';

export type HomeTab = 'devotion' | 'explore';

/**
 * 灵修页的两个入口。
 *
 * 原先"发现"是独立的底部 Tab，但它整理的东西（要素、图谱、导图、配图、讲道）
 * 全是围绕某一章的辅助材料，而灵修也是围绕同一章展开，分成两个 Tab
 * 反而让人来回跳。合并到这里，底部就只剩今日／读经／灵修／我的四个。
 *
 * 只渲染当前那一边：资料面板挂载时会去探一次缓存，
 * 藏着也照样发请求，不如切过去再挂。
 */
export default function DevotionHome({
  initialTab,
  explore,
  children,
}: {
  initialTab: HomeTab;
  explore: React.ReactNode;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState<HomeTab>(initialTab);

  const item = (key: HomeTab, label: string) => (
    <button
      onClick={() => setTab(key)}
      aria-current={tab === key ? 'page' : undefined}
      className={`-mb-px border-b-2 px-4 py-3 text-sm transition ${
        tab === key ? 'border-brand-500 font-semibold text-brand-700' : 'border-transparent text-muted'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* h-11 要与资料面板 header 的 top-11 对齐，否则两层吸顶会叠在一起 */}
      <div className="sticky top-0 z-40 flex h-11 items-stretch border-b border-line bg-paper/95 px-2 backdrop-blur">
        {item('devotion', '我的灵修')}
        {item('explore', '经文资料')}
      </div>

      {tab === 'devotion' ? children : explore}
    </div>
  );
}
