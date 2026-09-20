import type { ReactNode } from 'react';

/** 全站复用的轻量 SVG 图标与区块标题（不引图标库，保首屏） */

const stroke = 'currentColor';
const sw = 1.75;

type IconProps = { className?: string; size?: number };

function box(size: number, className?: string) {
  return `inline-block shrink-0 ${className ?? ''}`.trim();
}

export function IconChevronRight({ className, size = 18 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBook({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 5.5A2.5 2.5 0 017.5 3H19v18H7.5A2.5 2.5 0 005 18.5V5.5z" stroke={stroke} strokeWidth={sw} />
      <path d="M5 9h14M5 13h14" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

export function IconFlame({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3s4.5 4.2 4.5 8.2A4.5 4.5 0 0112 15.7a4.5 4.5 0 01-4.5-4.5C7.5 7.2 12 3 12 3z"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconNotes({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 4h10l2 2v14H8V4z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

export function IconSettings({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth={sw} />
      <path
        d="M12 2v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8l1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4m12.8-12.8l1.4-1.4"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconLock({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke={stroke} strokeWidth={sw} />
      <path d="M8 11V8a4 4 0 018 0v3" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

export function IconCompass({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth={sw} />
      <path d="M14.5 9.5L10 14l4.5-4.5z" fill={stroke} />
    </svg>
  );
}

export function IconPlay({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 7.5v9l8-4.5-8-4.5z" fill="currentColor" />
    </svg>
  );
}

export function IconCheck({ className, size = 16 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 12l4 4 8-9" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconStreak({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

export function IconSpark({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2l1.2 4.8L18 8l-4.8 1.2L12 14l-1.2-4.8L6 8l4.8-1.2L12 2z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    </svg>
  );
}

export function IconAdmin({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19h16M6 16l3-9 3 5 3-7 3 11" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconScripture({ className, size = 20 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4h12v16H6z" stroke={stroke} strokeWidth={sw} />
      <path d="M9 8h6M9 12h6" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

/** 区块小标题：图标 + 加粗字 */
export function SectionTitle({
  icon,
  children,
  className = '',
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`section-title ${className}`}>
      <span className="section-title-icon">{icon}</span>
      {children}
    </h2>
  );
}

/** 列表行左侧图标底 */
export function IconTile({
  children,
  tone = 'brand',
}: {
  children: ReactNode;
  tone?: 'brand' | 'muted' | 'accent';
}) {
  const bg =
    tone === 'accent' ? 'bg-accent/10 text-accent' : tone === 'muted' ? 'bg-line/80 text-muted' : 'bg-brand-100 text-brand-700';
  return <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>{children}</span>;
}
