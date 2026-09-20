'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** 说太久会把请求体撑得很大，到点自动收尾 */
const MAX_MS = 120_000;
/** 比这更短基本是误触，不值得送去识别 */
const MIN_MS = 500;

/**
 * 口述（R-B3）。点「口述」后自动开录，再点一次结束并转成文字；
 * 音频只在内存里中转，不落盘也不入库。
 */
export default function Recorder({
  onDone,
  busy,
  note,
  autoStart,
}: {
  onDone: (blob: Blob) => void;
  busy?: boolean;
  /** 松开之后文字去哪儿，由调用方说明：笔记那边是直接记下，灵修那边是填回输入框 */
  note?: string;
  /** 为 true 时挂载后立刻开始录音（口述弹层 / 口述页签） */
  autoStart?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'starting' | 'recording'>('idle');
  const [ms, setMs] = useState(0);
  const [error, setError] = useState('');

  const stateRef = useRef(state);
  stateRef.current = state;

  const active = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAt = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    const rec = recorder.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, [clearTimer]);

  const teardown = useCallback(() => {
    active.current = false;
    clearTimer();
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    if (recorder.current && recorder.current.state !== 'inactive') {
      try {
        recorder.current.stop();
      } catch {
        /* already stopped */
      }
    }
    recorder.current = null;
  }, [clearTimer]);

  useEffect(() => () => teardown(), [teardown]);

  const beginRecording = useCallback(async () => {
    if (busy || stateRef.current !== 'idle') return;
    active.current = true;
    setError('');
    setState('starting');

    if (!navigator.mediaDevices?.getUserMedia) {
      active.current = false;
      setState('idle');
      setError('当前浏览器不支持录音，请改用打字');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      active.current = false;
      setState('idle');
      setError('打不开话筒。请允许麦克风权限，或改用打字');
      return;
    }

    if (!active.current) {
      stream.getTracks().forEach((t) => t.stop());
      setState('idle');
      return;
    }

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
        setError('太短了，请多说几句');
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
        active.current = false;
        stop();
      }
    }, 100);
  }, [busy, onDone, stop]);

  useEffect(() => {
    if (!autoStart || busy) return;
    void beginRecording();
    return () => {
      active.current = false;
      if (recorder.current) stop();
    };
    // 只在挂载 / autoStart 变化时自动开录，不把 beginRecording 放进依赖以免重复触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  function onTap() {
    if (busy) return;
    if (state === 'recording') {
      active.current = false;
      stop();
      return;
    }
    if (state === 'idle') void beginRecording();
  }

  const mmss = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(
    Math.floor((ms % 60000) / 1000),
  ).padStart(2, '0')}`;

  const hint = busy
    ? '正在转成文字…'
    : state === 'recording'
      ? '说完点一下结束，自动转成文字'
      : state === 'starting'
        ? '正在打开话筒…'
        : '点一下开始录音';

  return (
    <div className="flex flex-col items-center gap-4 py-3">
      {error && <p className="text-center text-sm text-accent">{error}</p>}

      <p className="font-mono text-3xl tabular-nums text-ink">{mmss}</p>

      <button
        type="button"
        onClick={onTap}
        disabled={busy || state === 'starting'}
        className={`flex h-[76px] w-[76px] select-none items-center justify-center rounded-full text-white transition active:scale-95 disabled:opacity-60 ${
          state === 'recording' ? 'recording bg-accent' : 'bg-brand-500'
        }`}
        aria-label={state === 'recording' ? '结束录音' : '开始录音'}
      >
        {state === 'recording' ? (
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="7" y="7" width="10" height="10" rx="2" />
          </svg>
        ) : (
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <p className="text-sm text-muted">{hint}</p>
      <p className="text-center text-xs text-muted">
        {note}
        {note && <br />}
        只留下识别出的文字，不保存录音文件 · 单次最长 2 分钟
      </p>
    </div>
  );
}
