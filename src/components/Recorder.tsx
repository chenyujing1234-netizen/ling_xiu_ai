'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** 说太久会把请求体撑得很大，到点自动收尾 */
const MAX_MS = 120_000;
/** 比这更短基本是误触，不值得送去识别 */
const MIN_MS = 500;

/**
 * 口述笔记（R-B3）。按住说话、松开立刻转成文字，音频只在内存里中转，
 * 不落盘也不入库。用浏览器 MediaRecorder，不依赖 SDK，
 * 因此在微信小程序 web-view / 手机浏览器里都能跑（需 HTTPS 或 localhost）。
 */
export default function Recorder({
  onDone,
  busy,
}: {
  onDone: (blob: Blob) => void;
  busy?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'starting' | 'recording'>('idle');
  const [ms, setMs] = useState(0);
  const [error, setError] = useState('');

  const holding = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAt = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stop = useCallback(() => {
    clearTimer();
    const rec = recorder.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, [clearTimer]);

  async function press(e: React.PointerEvent<HTMLButtonElement>) {
    if (busy || state !== 'idle') return;
    e.preventDefault();
    // 手指／鼠标常会滑出按钮外才松开，捕获指针才能稳稳收到 pointerup
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 老浏览器没有指针捕获，退化成普通事件也能用 */
    }
    holding.current = true;
    setError('');
    setState('starting');

    if (!navigator.mediaDevices?.getUserMedia) {
      holding.current = false;
      setState('idle');
      setError('当前浏览器不支持录音，请改用打字');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      holding.current = false;
      setState('idle');
      setError('打不开话筒。请允许麦克风权限，或改用打字');
      return;
    }

    // 首次授权的弹窗可能停留好几秒，等拿到话筒时人早松手了，这时就别录了
    if (!holding.current) {
      stream.getTracks().forEach((t) => t.stop());
      setState('idle');
      return;
    }

    // iOS Safari 只支持 mp4，其它平台优先 webm/opus
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) =>
      MediaRecorder.isTypeSupported?.(m),
    );
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    rec.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const spoken = Date.now() - startAt.current;
      const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
      recorder.current = null;
      setState('idle');
      setMs(0);
      if (spoken < MIN_MS || blob.size === 0) {
        setError('太短了，按住多说几句');
        return;
      }
      onDone(blob);
    };

    rec.start();
    recorder.current = rec;
    startAt.current = Date.now();
    setMs(0);
    setState('recording');
    timer.current = setInterval(() => {
      const d = Date.now() - startAt.current;
      setMs(d);
      if (d >= MAX_MS) {
        holding.current = false;
        stop();
      }
    }, 100);
  }

  function release() {
    if (!holding.current) return;
    holding.current = false;
    // 还在等授权就松手了，没有录音机可停
    if (recorder.current) stop();
    else setState('idle');
  }

  const mmss = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(
    Math.floor((ms % 60000) / 1000),
  ).padStart(2, '0')}`;

  const hint = busy
    ? '正在转成文字…'
    : state === 'recording'
      ? '松开就结束'
      : state === 'starting'
        ? '正在打开话筒…'
        : '按住说话，松开就转成文字记下';

  return (
    <div className="flex flex-col items-center gap-4 py-3">
      {error && <p className="text-center text-sm text-accent">{error}</p>}

      <p className="font-mono text-3xl tabular-nums text-ink">{mmss}</p>

      <button
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        disabled={busy}
        style={{ touchAction: 'none' }}
        className={`flex h-[76px] w-[76px] select-none items-center justify-center rounded-full text-white transition active:scale-95 disabled:opacity-60 ${
          state === 'recording' ? 'recording bg-accent' : 'bg-brand-500'
        }`}
        aria-label="按住说话"
      >
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" strokeLinecap="round" />
        </svg>
      </button>

      <p className="text-sm text-muted">{hint}</p>
      <p className="text-center text-xs text-muted">
        松开即转成文字并直接记下，想改就点开这条笔记
        <br />
        只留下识别出的文字，不保存录音文件 · 单次最长 2 分钟
      </p>
    </div>
  );
}
