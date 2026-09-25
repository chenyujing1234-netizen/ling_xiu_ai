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

/** 双指 + 虚线：表示「长按」 */
export function IconLongPress({ className, size = 22 }: IconProps) {
  return (
    <svg className={box(size, className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 5v8a2 2 0 004 0V9" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M12 5v10a2 2 0 004 0V8" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M8 18h8" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="2 3" />
    </svg>
  );
}

/** 该条笔记已有与正文匹配的陪读者点评 */
export function NoteReviewedBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm ${className ?? ''}`}
      role="status"
      aria-label="陪读者已点评"
    >
      <IconCheck size={10} className="text-white" />
    </span>
  );
}

/** 经节旁：生成本节配图（需阻止冒泡，避免触发长按） */
export function VerseImageButton({
  onClick,
  disabled,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`ml-1.5 inline-flex shrink-0 align-middle items-center rounded-md border border-brand-200/90 bg-brand-50/80 px-1.5 py-0.5 text-[10px] font-bold leading-none text-brand-700 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${className ?? ''}`}
      aria-label="为本节生成配图"
    >
      配图
    </button>
  );
}

/** 经节末尾：提醒可长按记笔记（仅图标，不参与点击） */
export function VerseLongPressHint({ className }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none ml-1 inline-flex align-middle opacity-80 ${className ?? ''}`}
      role="img"
      aria-label="长按可记笔记"
    >
      <IconLongPress size={15} className="text-brand-400" />
    </span>
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
    tone === 'accent'
      ? 'bg-accent/15 text-accent shadow-sm'
      : tone === 'muted'
        ? 'bg-line/80 text-muted'
        : 'bg-gradient-to-br from-brand-100 to-brand-200/90 text-brand-700 shadow-sm';
  return <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>{children}</span>;
}

/** 底部弹层 / 对话框：统一右上角关闭（父容器需 `relative`） */
export function SheetCloseButton({
  onClick,
  disabled,
  className = '',
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="关闭"
      className={`absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-line/90 bg-card/95 text-[18px] leading-none text-muted shadow-soft active:bg-brand-50 disabled:opacity-50 ${className}`}
    >
      ×
    </button>
  );
}
