'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 录音笔记（R-B3）。用浏览器 MediaRecorder，不依赖任何 SDK，
 * 因此在微信小程序 web-view / 手机浏览器里都能跑（需 HTTPS 或 localhost）。
 */
export default function Recorder({
  onDone,
  busy,
}: {
  onDone: (blob: Blob, durationMs: number) => void;
  busy?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [ms, setMs] = useState(0);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAt = useRef(0);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // 仅在卸载时清理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持录音，请改用文字或手写');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // iOS Safari 只支持 mp4，其它平台优先 webm/opus
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(
        (m) => MediaRecorder.isTypeSupported?.(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setState('preview');
      };
      rec.start();
      recorder.current = rec;
      startAt.current = Date.now();
      setMs(0);
      setState('recording');
      timer.current = setInterval(() => setMs(Date.now() - startAt.current), 100);
    } catch {
      setError('无法访问麦克风。请检查浏览器权限，或改用文字/手写笔记');
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stop();
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    blobRef.current = null;
    setMs(0);
    setState('idle');
  }

  const mmss = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(
    Math.floor((ms % 60000) / 1000),
  ).padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center gap-4 py-3">
      {error && <p className="text-center text-sm text-accent">{error}</p>}

      {state === 'preview' ? (
        <>
          <audio src={previewUrl} controls className="w-full" />
          <div className="flex w-full gap-2">
            <button className="btn-ghost flex-1" onClick={reset} disabled={busy}>
              重录
            </button>
            <button
              className="btn-primary flex-1"
              disabled={busy}
              onClick={() => blobRef.current && onDone(blobRef.current, ms)}
            >
              {busy ? '保存中…' : '保存录音笔记'}
            </button>
          </div>
          <p className="text-center text-xs text-muted">保存后会尝试自动转成文字，转写失败也不影响录音留存</p>
        </>
      ) : (
        <>
          <p className="font-mono text-3xl tabular-nums text-ink">{mmss}</p>
          <button
            onClick={state === 'recording' ? stop : start}
            className={`flex h-[76px] w-[76px] items-center justify-center rounded-full text-white transition active:scale-95 ${
              state === 'recording' ? 'recording bg-accent' : 'bg-brand-500'
            }`}
            aria-label={state === 'recording' ? '停止录音' : '开始录音'}
          >
            {state === 'recording' ? (
              <span className="h-6 w-6 rounded-[4px] bg-white" />
            ) : (
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <p className="text-sm text-muted">
            {state === 'recording' ? '正在录音，说完点方块停止' : '点一下开始说，把想到的直接说出来'}
          </p>
        </>
      )}
    </div>
  );
}
