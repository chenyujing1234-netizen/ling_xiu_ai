'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_K = 0.25;
const MAX_K = 6;
const INLINE_H = 380;

type View = { k: number; x: number; y: number };
type Pt = { x: number; y: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * 图形的拖动 / 缩放容器。
 *
 * 知识图谱和思维导图往往比手机屏幕宽好几倍，只靠 overflow 横向滚动既看不全
 * （纵向直接被截断）也看不清。这里改成可平移可缩放：单指或鼠标拖动、双指捏合、
 * 滚轮缩放、双击放大，再加一个全屏模式。
 *
 * 缩放只作用在外层 CSS transform 上，SVG 自身的 width/height 保持原值，
 * 所以导出 PNG 拿到的仍是完整尺寸的图。
 */
export default function PanZoom({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });

  const pointers = useRef(new Map<number, Pt>());
  // 拖动过就不要把随后的 click 当成点节点
  const dragged = useRef(false);
  const captured = useRef(false);

  /**
   * 默认视图以宽度为准，而不是把整张图塞进容器。
   *
   * 实测一章的思维导图约 647×864，比容器高得多；若按整图适配，缩放只有 0.39，
   * 12px 的中文会糊成 4.7px 完全没法读。宽度才是硬约束（横向没地方可让），
   * 纵向本来就可以拖，所以按宽度适配并留一个下限，保证一上来就是能读的。
   */
  const fit = useCallback(() => {
    const el = box.current;
    if (!el?.clientWidth || !el.clientHeight) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const k = clamp(Math.max(cw / width, 0.55), MIN_K, 1);
    const w = width * k;
    const h = height * k;
    // 放得下就居中，放不下就贴左上角，从头开始看
    setView({ k, x: w <= cw ? (cw - w) / 2 : 0, y: h <= ch ? (ch - h) / 2 : 0 });
  }, [width, height]);

  /** 「适应」按钮：把整张图缩进容器看全貌，字会变小，看清楚再放大 */
  const fitAll = useCallback(() => {
    const el = box.current;
    if (!el?.clientWidth || !el.clientHeight) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const k = clamp(Math.min(cw / width, ch / height), MIN_K, 1);
    setView({ k, x: (cw - width * k) / 2, y: (ch - height * k) / 2 });
  }, [width, height]);

  // 首次挂载与进出全屏时重新适配（容器尺寸变了）
  useEffect(() => {
    fit();
  }, [fit, full]);

  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [full]);

  /** 以容器内某点为锚点缩放，该点在图上对应的位置保持不动 */
  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      const f = k / v.k;
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  }, []);

  const zoomCenter = useCallback(
    (factor: number) => {
      const el = box.current;
      if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, factor);
    },
    [zoomAt],
  );

  // React 的 onWheel 是 passive 的，preventDefault 会被忽略，只能自己绑
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
  }

  /**
   * 只有确认是拖动了才接管指针。若在 pointerdown 就 setPointerCapture，
   * 后续事件的 target 会全变成容器，知识图谱里的节点就点不开了。
   */
  function capture(e: React.PointerEvent) {
    if (captured.current) return;
    captured.current = true;
    box.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;

    const before = [...map.values()];
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const after = [...map.values()];

    if (before.length === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        dragged.current = true;
        capture(e);
      }
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      return;
    }

    // 双指：按两指间距变化缩放，同时跟随中点平移
    dragged.current = true;
    const r = box.current!.getBoundingClientRect();
    const d0 = dist(before[0], before[1]);
    const d1 = dist(after[0], after[1]);
    const c0 = mid(before[0], before[1]);
    const c1 = mid(after[0], after[1]);
    setView((v) => {
      const k = clamp(v.k * (d0 > 0 ? d1 / d0 : 1), MIN_K, MAX_K);
      const f = k / v.k;
      const px = c0.x - r.left;
      const py = c0.y - r.top;
      return {
        k,
        x: px - (px - v.x) * f + (c1.x - c0.x),
        y: py - (py - v.y) * f + (c1.y - c0.y),
      };
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) captured.current = false;
  }

  const btn =
    'flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card/95 text-[15px] leading-none shadow-sm active:bg-brand-50';

  return (
    <>
      {/* 全屏时原位留个占位，避免页面高度塌陷、滚动位置乱跳 */}
      {full && <div style={{ height: INLINE_H }} aria-hidden />}

      <div
        ref={box}
        className={
          full
            ? 'fixed inset-0 z-50 touch-none overscroll-none bg-[#fbf8f1]'
            : 'relative touch-none overscroll-none overflow-hidden rounded-2xl border border-line bg-[#fbf8f1]'
        }
        style={full ? undefined : { height: INLINE_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onDoubleClick={(e) => {
          const r = box.current!.getBoundingClientRect();
          zoomAt(e.clientX - r.left, e.clientY - r.top, view.k < 1.6 ? 2 : 0.5);
        }}
      >
        <div
          style={{
            width,
            height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: '0 0',
          }}
        >
          {children}
        </div>

        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button className={btn} onClick={() => setFull((f) => !f)} title={full ? '退出全屏' : '全屏查看'}>
            {full ? '✕' : '⤢'}
          </button>
          <button className={btn} onClick={() => zoomCenter(1.4)} title="放大">
            ＋
          </button>
          <button className={btn} onClick={() => zoomCenter(1 / 1.4)} title="缩小">
            －
          </button>
          <button className={`${btn} text-[11px]`} onClick={fitAll} title="缩到看全整张图">
            全图
          </button>
        </div>
      </div>
    </>
  );
}
