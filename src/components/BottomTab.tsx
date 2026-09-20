'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// R-G1：三个底部 Tab。图标用内联 SVG，避免图标库拖慢首屏。
// 原来的"发现"和"读经"都并进了"灵修"：这个产品没有脱离灵修的读经，
// 读经文、就着它灵修、查它的资料，本来就是同一件事的三个面，
// 摊成几个 Tab 只会让人来回跳。
/** 带 home=1 表示用户主动点 Tab，勿被 last_path 恢复逻辑弹回灵修页 */
const TABS = [
  { href: '/?home=1', label: '今日', icon: IconSun },
  { href: '/devotion', label: '灵修', icon: IconFlame },
  { href: '/me', label: '我的', icon: IconUser },
];

export default function BottomTab() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur"
      style={{ paddingBottom: 'var(--safe-b)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active =
            tab.href.startsWith('/?home=1') ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className="flex h-[56px] flex-col items-center justify-center gap-0.5 active:opacity-60"
                aria-current={active ? 'page' : undefined}
              >
                {/* 选中态除了换色还垫一个药丸底：brand-500 与 muted 的明度太接近，
                    只靠文字颜色在 10px 字号下分不出来，得有个形状上的差别 */}
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                    active ? 'bg-brand-100' : ''
                  }`}
                >
                  <tab.icon className={active ? 'text-brand-700' : 'text-muted'} />
                </span>
                <span className={`text-[10px] ${active ? 'font-semibold text-brand-700' : 'text-muted'}`}>
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type P = { className?: string };
const base = 'h-[22px] w-[22px]';

function IconSun({ className }: P) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" strokeLinecap="round" />
    </svg>
  );
}

function IconFlame({ className }: P) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3s4.5 4.2 4.5 8.2A4.5 4.5 0 0112 15.7a4.5 4.5 0 01-4.5-4.5C7.5 7.2 12 3 12 3z" strokeLinejoin="round" />
      <path d="M9.2 15.5c0 2 1.3 3.5 2.8 3.5s2.8-1.5 2.8-3.5" strokeLinecap="round" />
      <path d="M12 21v-1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconUser({ className }: P) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" strokeLinecap="round" />
    </svg>
  );
}
