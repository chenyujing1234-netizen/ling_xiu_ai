'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { canUseInPageRecorder, isWeChatBrowser } from '@/lib/recorder-capability';
import { noteRecordingEntered, noteRecordingLeft } from '@/lib/note-recording-guard';

const MAX_MS = 120_000;
const MIN_MS = 500;

export default function Recorder({
  onDone,
  busy,
  note,
  autoStart,
}: {
  onDone: (blob: Blob) => void;
  busy?: boolean;
  note?: string;
  /** 挂载后自动开麦（须在同一用户手势链路上打开面板，如长按记笔记） */
  autoStart?: boolean;
}) {
  const useInPage = canUseInPageRecorder();
  const [state, setState] = useState<'idle' | 'starting' | 'recording'>('idle');
  const [ms, setMs] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const wechat = isWeChatBrowser();

  const stateRef = useRef(state);
  stateRef.current = state;

  const genRef = useRef(0);
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
    genRef.current += 1;
    clearTimer();
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    if (recorder.current && recorder.current.state !== 'inactive') {
      try {
        recorder.current.stop();
      } catch {
        /* noop */
      }
    }
    recorder.current = null;
  }, [clearTimer]);

  useEffect(() => () => teardown(), [teardown]);

  useEffect(() => {
    if (state !== 'starting' && state !== 'recording') return;
    noteRecordingEntered();
    return () => noteRecordingLeft();
  }, [state]);

  const beginRecording = useCallback(async () => {
    if (busy || stateRef.current !== 'idle') return;
    const gen = ++genRef.current;
    setError('');
    setState('starting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      if (gen !== genRef.current) return;
      setState('idle');
      setError('打不开话筒。请在系统设置里允许微信使用麦克风，或改用「写下」');
      return;
    }

    if (gen !== genRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      setState('idle');
      return;
    }

    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'].find((m) =>
      MediaRecorder.isTypeSupported?.(m),
    );

    let rec: MediaRecorder;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setState('idle');
      setError('无法启动录音，请点「用系统录音」或改用写下');
      return;
    }

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

    try {
      rec.start();
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setState('idle');
      setError('录音启动失败，请再试一次');
      return;
    }

    recorder.current = rec;
    startAt.current = Date.now();
    setMs(0);
    setState('recording');
    timer.current = setInterval(() => {
      const d = Date.now() - startAt.current;
      setMs(d);
      if (d >= MAX_MS) {
        genRef.current += 1;
        stop();
      }
    }, 100);
  }, [busy, onDone, stop]);

  useEffect(() => {
    if (!autoStart || !useInPage || busy) return;
    void beginRecording();
  }, [autoStart, useInPage, busy, beginRecording]);

  function onTap() {
    if (busy) return;
    if (state === 'recording') {
      genRef.current += 1;
      stop();
      return;
    }
    if (state === 'idle') void beginRecording();
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || file.size === 0) return;
    onDone(file);
  }

  const mmss = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(
    Math.floor((ms % 60000) / 1000),
  ).padStart(2, '0')}`;

  if (!useInPage) {
    return (
      <div className="flex flex-col items-center gap-4 py-3">
        {error && <p className="text-center text-sm text-accent">{error}</p>}
        <p className="text-center text-sm leading-relaxed text-muted">
          {isWeChatBrowser()
            ? '当前微信环境请用系统录音，录完会自动转成文字。'
            : '当前浏览器不支持页内录音，请用系统录音或改用写下。'}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          capture
          className="hidden"
          onChange={onFilePicked}
        />
        <button
          type="button"
          className="btn-primary w-full max-w-xs py-3"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? '正在转成文字…' : '用系统录音'}
        </button>
        <p className="text-center text-xs text-muted">
          {note}
          {note && <br />}
          录完后选择刚生成的语音文件即可
        </p>
      </div>
    );
  }

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
      {wechat && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            capture
            className="hidden"
            onChange={onFilePicked}
          />
          <button
            type="button"
            className="btn-ghost text-xs"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            微信里若无法开麦，改用系统录音
          </button>
        </>
      )}
    </div>
  );
}
