'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useBindOverlayHistory } from '@/lib/overlay-history';
import { parseJobResult, type JobResultView } from '@/lib/background-job-result';
import BackgroundJobResultSheet from './BackgroundJobResultSheet';
import { shouldDeferBackgroundJobPresent } from '@/lib/note-recording-guard';

export type BackgroundJobStatus = 'running' | 'done' | 'error';

export type BackgroundJob = {
  id: string;
  label: string;
  status: BackgroundJobStatus;
  error?: string;
  finishedAt?: number;
};

type RunJobOptions<T> = {
  label: string;
  task: () => Promise<T>;
  onSuccess?: (data: T) => void;
  onError?: (err: Error) => void;
  present?: () => void;
  throwFrom?: { x: number; y: number };
};

type Ctx = {
  jobs: BackgroundJob[];
  runningCount: number;
  runJob: <T>(opts: RunJobOptions<T>) => { id: string; promise: Promise<T> };
  markMinimized: (id: string) => void;
  dismissJob: (id: string) => void;
};

const BackgroundJobsContext = createContext<Ctx | null>(null);

const BAG_ID = 'lx-bg-job-bag';
const MAX_JOBS = 30;

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function statusLabel(status: BackgroundJobStatus) {
  if (status === 'running') return '生成中';
  if (status === 'done') return '已完成 · 查看';
  return '失败';
}

export function BackgroundJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [bagPulse, setBagPulse] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const presentMap = useRef(new Map<string, () => void>());
  const resultMap = useRef(new Map<string, unknown>());
  const [resultView, setResultView] = useState<JobResultView | null>(null);

  const runningCount = jobs.filter((j) => j.status === 'running').length;
  const totalCount = jobs.length;

  useBindOverlayHistory(panelOpen, () => setPanelOpen(false));

  const spawnThrow = useCallback((from?: { x: number; y: number }) => {
    const bag = document.getElementById(BAG_ID);
    const bagRect = bag?.getBoundingClientRect();
    const toX = bagRect ? bagRect.left + bagRect.width / 2 : window.innerWidth - 28;
    const toY = bagRect ? bagRect.top + bagRect.height / 2 : 48;

    const fromX = from?.x ?? window.innerWidth / 2;
    const fromY = from?.y ?? window.innerHeight * 0.72;

    const el = document.createElement('div');
    el.className = 'lx-bg-throw-dot';
    el.style.setProperty('--from-x', `${fromX}px`);
    el.style.setProperty('--from-y', `${fromY}px`);
    el.style.setProperty('--to-x', `${toX}px`);
    el.style.setProperty('--to-y', `${toY}px`);
    document.body.appendChild(el);
    el.addEventListener(
      'animationend',
      () => {
        el.remove();
        setBagPulse(true);
        window.setTimeout(() => setBagPulse(false), 420);
      },
      { once: true },
    );
  }, []);

  const finishJob = useCallback((id: string, patch: Partial<BackgroundJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const dismissJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    presentMap.current.delete(id);
    resultMap.current.delete(id);
  }, []);

  const runJob = useCallback(
    <T,>(opts: RunJobOptions<T>) => {
      const id = nextId();
      setJobs((prev) =>
        [{ id, label: opts.label, status: 'running' as const }, ...prev].slice(0, MAX_JOBS),
      );
      if (opts.present) presentMap.current.set(id, opts.present);
      spawnThrow(opts.throwFrom);

      const promise = opts
        .task()
        .then((data) => {
          finishJob(id, { status: 'done', finishedAt: Date.now() });
          resultMap.current.set(id, data);
          opts.onSuccess?.(data);
          const present = presentMap.current.get(id);
          if (present) {
            window.setTimeout(() => {
              if (shouldDeferBackgroundJobPresent()) {
                setBagPulse(true);
                window.setTimeout(() => setBagPulse(false), 420);
                return;
              }
              try {
                present();
              } catch {
                /* 组件已卸载时忽略 */
              }
            }, 80);
          }
          return data;
        })
        .catch((err: Error) => {
          finishJob(id, {
            status: 'error',
            error: err.message || '生成失败',
            finishedAt: Date.now(),
          });
          opts.onError?.(err);
          throw err;
        });

      return { id, promise };
    },
    [finishJob, spawnThrow],
  );

  const markMinimized = useCallback((_id: string) => {}, []);

  const openJobPresent = useCallback((job: BackgroundJob) => {
    if (job.status === 'running') return;

    setPanelOpen(false);

    const show = () => {
      if (job.status === 'error') {
        if (job.error?.trim()) {
          setResultView({
            kind: 'text',
            title: job.label,
            body: job.error.trim(),
            isError: true,
          });
        }
        return;
      }

      const parsed = parseJobResult(job.label, resultMap.current.get(job.id));
      if (parsed) {
        setResultView(parsed);
        return;
      }

      const present = presentMap.current.get(job.id);
      if (present) {
        try {
          present();
        } catch {
          /* ignore */
        }
        return;
      }

      setResultView({
        kind: 'text',
        title: job.label,
        body: '结果已生成。请回到刚才的页面查看；若页面已关闭，可重新打开对应功能。',
      });
    };

    window.setTimeout(show, 64);
  }, []);

  const clearFinished = useCallback(() => {
    setJobs((prev) => {
      for (const j of prev) {
        if (j.status !== 'running') {
          presentMap.current.delete(j.id);
          resultMap.current.delete(j.id);
        }
      }
      return prev.filter((j) => j.status === 'running');
    });
  }, []);

  const value = useMemo(
    () => ({ jobs, runningCount, runJob, markMinimized, dismissJob }),
    [jobs, runningCount, runJob, markMinimized, dismissJob],
  );

  return (
    <BackgroundJobsContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        totalCount > 0 &&
        createPortal(
          <>
            <button
              type="button"
              id={BAG_ID}
              className={`lx-bg-bag ${bagPulse ? 'lx-bg-bag-pulse' : ''} ${runningCount ? 'lx-bg-bag-active' : ''}`}
              aria-label={`后台任务 ${totalCount} 项，点击查看列表`}
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
            >
              <span className="lx-bg-bag-pocket" aria-hidden />
              <span className="lx-bg-bag-count">{totalCount > 99 ? '99+' : totalCount}</span>
            </button>

            {panelOpen && (
              <>
                <button
                  type="button"
                  className="lx-bg-job-backdrop"
                  aria-label="关闭任务列表"
                  onClick={() => setPanelOpen(false)}
                />
                <div className="lx-bg-job-panel" role="dialog" aria-label="后台任务列表">
                  <div className="lx-bg-job-panel-head">
                    <p className="text-sm font-bold text-ink">后台任务</p>
                    <p className="text-[11px] text-muted">
                      共 {totalCount} 项
                      {runningCount > 0 ? ` · ${runningCount} 项进行中` : ''}
                    </p>
                  </div>
                  <ul className="lx-bg-job-panel-list no-bar">
                    {jobs.map((j) => (
                      <li key={j.id}>
                        <button
                          type="button"
                          className={`lx-bg-job-row ${j.status}`}
                          onClick={() => openJobPresent(j)}
                          disabled={j.status === 'running'}
                          aria-disabled={j.status === 'running'}
                        >
                          <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">
                            {j.label}
                          </span>
                          <span className="shrink-0 text-[10px] font-bold opacity-85">
                            {statusLabel(j.status)}
                          </span>
                        </button>
                        {j.status === 'error' && j.error && (
                          <p className="px-3 pb-2 text-[11px] leading-snug text-accent">{j.error}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                  {jobs.some((j) => j.status !== 'running') && (
                    <button type="button" className="lx-bg-job-clear" onClick={clearFinished}>
                      清除已完成 / 失败
                    </button>
                  )}
                </div>
              </>
            )}
          </>,
          document.body,
        )}
      {resultView && (
        <BackgroundJobResultSheet view={resultView} onClose={() => setResultView(null)} />
      )}
    </BackgroundJobsContext.Provider>
  );
}

export function useBackgroundJobs() {
  const ctx = useContext(BackgroundJobsContext);
  if (!ctx) throw new Error('useBackgroundJobs 须在 BackgroundJobsProvider 内使用');
  return ctx;
}

export function useBackgroundJobsOptional() {
  return useContext(BackgroundJobsContext);
}
