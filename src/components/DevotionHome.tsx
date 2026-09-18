'use client';

import { useEffect, useState } from 'react';

export type HomeTab = 'read' | 'devotion' | 'explore';

/**
 * 灵修页的三个入口：读经、我的灵修、经文资料。
 *
 * 底部原来还有"发现"和"读经"两个 Tab，现在都并到了这里 ——
 * 三者都是围绕"某一章"展开的：读它、就着它灵修、查它的辅助材料。
 * 这个产品本来就没有脱离灵修的"读经"，分成几个 Tab 只会让人来回跳。
 *
 * 默认停在读经：每天真正的入口动作是打开经文，回看记录是次一级的需求。
 */
export default function DevotionHome({
  initialTab,
  read,
  explore,
  children,
}: {
  initialTab: HomeTab;
  read: React.ReactNode;
  explore: React.ReactNode;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState<HomeTab>(initialTab);

  // 读经这一页进过之后就留着不卸载：读到第几章、中英对照开没开，
  // 切去查资料再切回来不该从头开始。
  // 另两页仍然按需挂载 —— 资料面板一挂载就会去探缓存，藏着也照样发请求。
  const [readAlive, setReadAlive] = useState(initialTab === 'read');
  useEffect(() => {
    if (tab === 'read') setReadAlive(true);
    // 把当前页签写回地址栏，否则刷新或分享出去会跳回另一页。
    // 读经是默认页签，不用挂在地址栏上占地方
    const url = new URL(window.location.href);
    if (tab === 'read') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  }, [tab]);

  const item = (key: HomeTab, label: string) => (
    <button
      onClick={() => setTab(key)}
      aria-current={tab === key ? 'page' : undefined}
      className={`-mb-px border-b-2 px-3.5 py-3 text-sm transition ${
        tab === key ? 'border-brand-500 font-semibold text-brand-700' : 'border-transparent text-muted'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* h-11 要与读经顶栏、资料面板 header 的 top-11 对齐，否则两层吸顶会叠在一起 */}
      <div className="sticky top-0 z-40 flex h-11 items-stretch border-b border-line bg-paper/95 px-1 backdrop-blur">
        {item('read', '读经')}
        {item('devotion', '我的灵修')}
        {item('explore', '经文资料')}
      </div>

      {readAlive && <div className={tab === 'read' ? undefined : 'hidden'}>{read}</div>}
      {tab === 'devotion' && children}
      {tab === 'explore' && explore}
    </div>
  );
}
