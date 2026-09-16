'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 手写笔记（R-B3）。Canvas 手写板，支持触屏与鼠标，可撤销。
 * 导出 PNG 交给上层上传。
 */
export default function Handwriting({
  onDone,
  busy,
}: {
  onDone: (blob: Blob) => void;
  busy?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const current = useRef<{ x: number; y: number }[]>([]);
  const [empty, setEmpty] = useState(true);

  // 按容器宽度初始化画布，并按 devicePixelRatio 放大避免笔迹发虚
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = 260;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2c2620';
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function paint() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    // 淡横线，像信纸
    ctx.save();
    ctx.strokeStyle = '#e8e0d4';
    ctx.lineWidth = 1;
    for (let y = 40; y < 260; y += 40) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(canvas.width / ratio - 8, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = '#2c2620';
    ctx.lineWidth = 2.4;
    for (const stroke of [...strokes.current, current.current]) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (const p of stroke.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    current.current = [pos(e)];
    canvasRef.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    current.current.push(pos(e));
    paint();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (current.current.length > 1) {
      strokes.current.push(current.current);
      setEmpty(false);
    }
    current.current = [];
    paint();
  };

  function undo() {
    strokes.current.pop();
    setEmpty(strokes.current.length === 0);
    paint();
  }
  function clear() {
    strokes.current = [];
    current.current = [];
    setEmpty(true);
    paint();
  }

  function save() {
    // 导出时铺白底，避免透明 PNG 在深色环境看不见
    const src = canvasRef.current!;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    out.toBlob((blob) => blob && onDone(blob), 'image/png');
  }

  return (
    <div className="space-y-3 py-2">
      <canvas
        ref={canvasRef}
        className="no-select w-full touch-none rounded-xl border border-line bg-[#fffdf8]"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
      />
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={undo} disabled={empty || busy}>
          撤销
        </button>
        <button className="btn-ghost flex-1" onClick={clear} disabled={empty || busy}>
          清空
        </button>
        <button className="btn-primary flex-[1.4]" onClick={save} disabled={empty || busy}>
          {busy ? '保存中…' : '保存手写'}
        </button>
      </div>
      <p className="text-center text-xs text-muted">用手指或触控笔直接写，写完保存为图片</p>
    </div>
  );
}
