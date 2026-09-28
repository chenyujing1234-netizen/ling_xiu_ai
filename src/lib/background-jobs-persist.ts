import type { JobRecovery } from '@/lib/background-job-recovery';

export type StoredBackgroundJob = {
  id: string;
  label: string;
  status: 'running' | 'done' | 'error';
  error?: string;
  finishedAt?: number;
  startedAt?: number;
  recovery?: JobRecovery;
};

const KEY = 'lx_bg_jobs_v1';
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type PersistedBackgroundJobs = {
  jobs: StoredBackgroundJob[];
  results: Record<string, unknown>;
  savedAt: number;
};

export function loadPersistedBackgroundJobs(): PersistedBackgroundJobs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedBackgroundJobs;
    if (!parsed?.jobs || !Array.isArray(parsed.jobs)) return null;
    if (Date.now() - (parsed.savedAt ?? 0) > MAX_AGE_MS) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedBackgroundJobs(
  jobs: StoredBackgroundJob[],
  results: Record<string, unknown>,
) {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedBackgroundJobs = {
      jobs,
      results,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* 配额满等 */
  }
}

export function normalizeJobsOnRestore(jobs: StoredBackgroundJob[]): StoredBackgroundJob[] {
  const now = Date.now();
  return jobs.map((j) => {
    if (j.status !== 'running') return j;
    if (!j.recovery) {
      return {
        ...j,
        status: 'error' as const,
        error: '页面已离开，无法续接此任务，请重新发起',
        finishedAt: now,
      };
    }
    return j;
  });
}
