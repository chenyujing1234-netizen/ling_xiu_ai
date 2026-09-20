'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { IconBook, IconFlame } from '@/components/Ui';

export type HomeTab = 'devotion' | 'explore';

/**
 * 灵修页的两个入口：我的灵修、经文资料。
 * 经文阅读与按住写笔记在灵修七步流程里的「经文」区块完成，不再单独占一页。
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

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === 'devotion') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  }, [tab]);

  const item = (key: HomeTab, label: string, icon: ReactNode) => (
    <button
      onClick={() => setTab(key)}
      aria-current={tab === key ? 'page' : undefined}
      className={`-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-3 text-sm transition ${
        tab === key ? 'border-brand-500 font-bold text-brand-700' : 'border-transparent font-medium text-muted'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div>
      <div className="sticky top-0 z-40 flex h-11 items-stretch border-b border-line bg-paper/95 px-1 backdrop-blur">
        {item('devotion', '我的灵修', <IconFlame size={17} />)}
        {item('explore', '经文资料', <IconBook size={17} />)}
      </div>

      <div className={tab === 'devotion' ? undefined : 'hidden'} aria-hidden={tab !== 'devotion'}>
        {children}
      </div>
      <div className={tab === 'explore' ? undefined : 'hidden'} aria-hidden={tab !== 'explore'}>
        {explore}
      </div>
    </div>
  );
}
