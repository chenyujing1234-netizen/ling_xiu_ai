'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { joinDictation } from '@/lib/dictate';
import Dictate from './Dictate';
import Waiting from './Waiting';

// ---------- 类型 ----------

type Stage = 'observe' | 'inquire' | 'reflect' | 'guided' | 'life' | 'prayer' | 'done';

type Devotion = {
  id: number;
  book_id: number;
  chapter: number;
  verse_start: number;
  verse_end: number;
  stage: Stage;
  score: number;
  unlocked: number;
  completed_at: string | null;
};
type Input = { id: number; kind: string; content: string; created_at: string };
type Prompt = { id: number; layer: string; bridge: string | null; question: string };
type Score = { dimension: string; score: number; reason: string };
type CoachMsg = { role: string; content: string };
type Verse = { verse: number; cn: string; en: string };
type Note = { id: number; verse: number; kind: string; content: string; media_path: string | null; god_spoke: number };

type Detail = {
  devotion: Devotion;
  unlockScore: number;
  passage: { label: string; genre: string; verses: Verse[] };
  inputs: Input[];
  prompts: Prompt[];
  scores: Score[];
  coach: CoachMsg[];
  notes: Note[];
  gate: { ok: boolean; reason?: string };
};

const STEPS: { key: Stage; label: string }[] = [
  { key: 'observe', label: '观察' },
  { key: 'inquire', label: '提问' },
  { key: 'reflect', label: '默想' },
  { key: 'guided', label: '引导' },
  { key: 'life', label: '实事' },
  { key: 'prayer', label: '祷告' },
];

const LAYER_LABEL: Record<string, string> = {
  fact: '事实层',
  flow: '脉络层',
  theology: '要义层',
  application: '处境层',
};

const DIM_LABEL: Record<string, string> = {
  observation: '观察准确',
  inquiry: '提问深度',
  thesis: '要义把握',
  personal: '个人化',
};

// ---------- 主组件 ----------

export default function DevotionFlow({ id }: { id: number }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setD(await api<Detail>(`/api/devotion/${id}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async <T,>(payload: Record<string, unknown>): Promise<T | null> => {
      setBusy(true);
      setError('');
      try {
        const res = await api<T>(`/api/devotion/${id}/action`, { json: payload });
        await load();
        return res;
      } catch (err) {
        setError((err as Error).message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [id, load],
  );

  if (error && !d) {
    return <p className="mx-4 mt-8 rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>;
  }
  if (!d) return <p className="py-20 text-center text-sm text-muted">加载中…</p>;

  const stage = d.devotion.stage;
  const stageIndex = STEPS.findIndex((s) => s.key === stage);

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[17px] font-semibold">{d.passage.label}</h1>
          <Link
            href={`/devotion?tab=read&book=${d.devotion.book_id}&chapter=${d.devotion.chapter}&devotion=${id}`}
            className="text-xs text-brand-500"
          >
            看经文 →
          </Link>
        </div>
        <Stepper current={stageIndex} stage={stage} />
      </header>

      <div className="px-4 py-4">
        {error && (
          <p className="mb-4 rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{error}</p>
        )}

        {stage === 'observe' && <ObserveStage d={d} act={act} busy={busy} reload={load} />}
        {stage === 'inquire' && <InquireStage d={d} act={act} busy={busy} reload={load} />}
        {stage === 'reflect' && <ReflectStage d={d} act={act} busy={busy} reload={load} />}
        {stage === 'guided' && <GuidedStage d={d} act={act} busy={busy} reload={load} />}
        {stage === 'life' && <LifeStage d={d} act={act} busy={busy} reload={load} />}
        {stage === 'prayer' && <PrayerStage d={d} act={act} busy={busy} reload={load} />}
        {stage === 'done' && <DoneStage d={d} />}
      </div>
    </div>
  );
}

type ActFn = <T,>(payload: Record<string, unknown>) => Promise<T | null>;
type StageProps = { d: Detail; act: ActFn; busy: boolean; reload: () => Promise<void> };

// ---------- 进度条 ----------

function Stepper({ current, stage }: { current: number; stage: Stage }) {
  return (
    <ol className="mt-2.5 flex items-center gap-1">
      {STEPS.map((s, i) => {
        const done = stage === 'done' || i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={`h-1 w-full rounded-full ${
                done ? 'bg-brand-500' : active ? 'bg-brand-300' : 'bg-line'
              }`}
            />
            <span className={`text-[10px] ${active ? 'font-medium text-brand-500' : 'text-muted'}`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- 经文（可折叠） ----------

function Passage({ verses, notes }: { verses: Verse[]; notes?: Note[] }) {
  const [open, setOpen] = useState(true);
  const spoke = new Set((notes ?? []).filter((n) => n.god_spoke).map((n) => n.verse));

  return (
    <section className="card mb-4 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="label">经文</span>
        <span className="text-xs text-muted">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="max-h-[38vh] overflow-y-auto px-4 pb-4 no-bar">
          {verses.map((v) => (
            <p
              key={v.verse}
              className={`scripture text-[15px] ${spoke.has(v.verse) ? 'text-accent' : ''}`}
            >
              <sup className="mr-1 text-[11px] text-brand-300">{v.verse}</sup>
              {v.cn}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** 阶段说明卡：每一步先说清"这一步要你做什么" */
function StageIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-[19px] font-semibold">{title}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function NextButton({
  gate,
  onNext,
  busy,
  label = '进入下一步',
}: {
  gate: { ok: boolean; reason?: string };
  onNext: () => void;
  busy: boolean;
  label?: string;
}) {
  return (
    <div className="mt-5">
      <button className="btn-primary w-full py-3" onClick={onNext} disabled={busy || !gate.ok}>
        {busy ? '处理中…' : label}
      </button>
      {!gate.ok && gate.reason && (
        <p className="mt-2 text-center text-xs text-muted">{gate.reason}</p>
      )}
    </div>
  );
}

// ---------- 1. 观察 ----------

function ObserveStage({ d, act, busy }: StageProps) {
  const [text, setText] = useState('');
  const [nudges, setNudges] = useState<string[] | null>(null);
  const [nudgeBusy, setNudgeBusy] = useState(false);
  const saved = d.inputs.filter((i) => i.kind === 'observation');
  const chars = saved.reduce((n, i) => n + i.content.replace(/\s/g, '').length, 0);

  async function askForHelp() {
    setNudgeBusy(true);
    try {
      const res = await api<{ questions: string[] }>(
        `/api/devotion/nudge?book=${d.devotion.book_id}&chapter=${d.devotion.chapter}`,
      );
      setNudges(res.questions);
    } finally {
      setNudgeBusy(false);
    }
  }

  return (
    <div>
      <StageIntro title="先写下你看见的">
        还不要写感想和心得。只写经文里<strong className="font-medium text-ink">确实存在</strong>的东西：
        谁、在什么时候、在哪里、做了什么、事情怎么一步步推过来的。写下来你才会发现自己漏掉了什么。
      </StageIntro>

      <Passage verses={d.passage.verses} notes={d.notes} />

      {saved.length > 0 && (
        <ul className="mb-3 space-y-2">
          {saved.map((i) => (
            <li key={i.id} className="card flex items-start gap-2 px-4 py-3">
              <p className="flex-1 text-[14px] leading-relaxed">{i.content}</p>
              <button
                className="text-xs text-muted"
                onClick={() => act({ action: 'removeInput', inputId: i.id })}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        className="field min-h-[130px] resize-none"
        placeholder="例如：这段里出现了三个人，起因是……，中间发生了……，最后……"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">已写 {chars} 字（至少 30 字）</span>
        <div className="flex items-center gap-2">
        <Dictate onText={(t) => setText((prev) => joinDictation(prev, t))} disabled={busy} />
        <button
          className="btn-ghost px-3 py-1.5 text-xs"
          disabled={busy || text.trim().length < 2}
          onClick={async () => {
            const ok = await act({ action: 'input', kind: 'observation', content: text.trim() });
            if (ok) setText('');
          }}
        >
          添加
        </button>
        </div>
      </div>

      {/* R-D5 兜底追问 */}
      <div className="mt-5">
        {!nudges ? (
          <button className="text-sm text-brand-500 underline-offset-4 hover:underline" onClick={askForHelp} disabled={nudgeBusy}>
            {nudgeBusy ? '想问题中…' : '读完了，但我写不出来'}
          </button>
        ) : (
          <div className="card px-4 py-3">
            <p className="label mb-2">那我问你几个问题</p>
            <ul className="space-y-2">
              {nudges.map((q, i) => (
                <li key={i} className="text-[14px] leading-relaxed text-ink/90">
                  {i + 1}. {q}
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-xs text-muted">随便挑一个，把想到的写在上面的框里。</p>
          </div>
        )}
      </div>

      <NextButton gate={d.gate} busy={busy} onNext={() => act({ action: 'advance' })} label="下一步：自己提问" />
    </div>
  );
}

// ---------- 2. 自己提问 ----------

function InquireStage({ d, act, busy }: StageProps) {
  const [text, setText] = useState('');
  const questions = d.inputs.filter((i) => i.kind === 'question');

  return (
    <div>
      <StageIntro title="现在换你提问">
        这一步不是回答问题，是<strong className="font-medium text-ink">你自己提问</strong>。
        把读的时候心里冒出来的疑问、卡住的地方、觉得不对劲的地方写出来。
        不用怕问得幼稚，问那种你自己都答不上来的问题最好。
      </StageIntro>

      <Passage verses={d.passage.verses} notes={d.notes} />

      <div className="card mb-4 bg-brand-50/60 px-4 py-3">
        <p className="label mb-1.5">可以从这些角度问</p>
        <p className="text-[13px] leading-relaxed text-brand-700">
          他为什么这样做？这里为什么突然提到……？这句话和前面那句是不是有矛盾？
          如果我在场我会怎么反应？神为什么允许这件事？
        </p>
      </div>

      {questions.length > 0 && (
        <ul className="mb-3 space-y-2">
          {questions.map((q, n) => (
            <li key={q.id} className="card flex items-start gap-2 px-4 py-3">
              <span className="mt-0.5 text-xs text-brand-300">{n + 1}</span>
              <p className="flex-1 text-[14px] leading-relaxed">{q.content}</p>
              <button className="text-xs text-muted" onClick={() => act({ action: 'removeInput', inputId: q.id })}>
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          className="field flex-1"
          placeholder="写下你的一个问题…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && text.trim().length > 4) {
              const ok = await act({ action: 'input', kind: 'question', content: text.trim() });
              if (ok) setText('');
            }
          }}
        />
        <button
          className="btn-ghost"
          disabled={busy || text.trim().length < 5}
          onClick={async () => {
            const ok = await act({ action: 'input', kind: 'question', content: text.trim() });
            if (ok) setText('');
          }}
        >
          添加
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">已提 {questions.length} 个问题（至少 2 个）</p>
        <Dictate
          onText={(t) => setText((prev) => joinDictation(prev, t, ' '))}
          disabled={busy}
          hint="说完自动填进上面的问题框"
        />
      </div>

      <NextButton gate={d.gate} busy={busy} onNext={() => act({ action: 'advance' })} label="下一步：默想作答" />
    </div>
  );
}

// ---------- 3. 默想作答 + 评分 ----------

function ReflectStage({ d, act, busy }: StageProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [scoreResult, setScoreResult] = useState<{
    total: number;
    unlocked: boolean;
    scores: Score[];
    encouragement: string;
    degraded: boolean;
  } | null>(null);
  const asked = useRef(false);

  // 进入本阶段自动出题（四层思辨题）
  useEffect(() => {
    if (d.prompts.length || asked.current) return;
    asked.current = true;
    setLoadingPrompts(true);
    act({ action: 'prompts' }).finally(() => setLoadingPrompts(false));
  }, [d.prompts.length, act]);

  const savedAnswers = d.inputs.filter((i) => i.kind === 'answer');
  const myQuestions = d.inputs.filter((i) => i.kind === 'question');
  const answeredIds = new Set(savedAnswers.map((a) => (a as Input & { prompt_id?: number }).prompt_id));

  async function submitAnswer(promptId: number) {
    const content = (answers[promptId] ?? '').trim();
    if (content.length < 2) return;
    const ok = await act({ action: 'input', kind: 'answer', content, promptId });
    if (ok) setAnswers({ ...answers, [promptId]: '' });
  }

  async function evaluate() {
    const res = await act<typeof scoreResult>({ action: 'score' });
    if (res) setScoreResult(res);
  }

  const unlocked = Boolean(d.devotion.unlocked);

  return (
    <div>
      <StageIntro title="用你自己的话回答">
        下面的问题没有标准答案，也不是考试。答完之后会有一次评估 ——
        评的不是你答得对不对，而是你有没有真的自己想过。达到 {d.unlockScore} 分才开启引导。
      </StageIntro>

      <Passage verses={d.passage.verses} notes={d.notes} />

      {myQuestions.length > 0 && (
        <div className="card mb-4 bg-brand-50/60 px-4 py-3">
          <p className="label mb-1.5">你自己提的问题（等会儿引导会先回应它们）</p>
          <ul className="space-y-1">
            {myQuestions.map((q, i) => (
              <li key={q.id} className="text-[13px] leading-relaxed text-brand-700">
                {i + 1}. {q.content}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadingPrompts && <Waiting text="正在为你出题…" expect="通常 20-40 秒" />}

      <div className="space-y-3">
        {d.prompts.map((p) => {
          const done = answeredIds.has(p.id);
          const mine = savedAnswers.find((a) => (a as Input & { prompt_id?: number }).prompt_id === p.id);
          return (
            <div key={p.id} className="card px-4 py-3.5">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="chip">{LAYER_LABEL[p.layer] ?? p.layer}</span>
                {p.bridge && <span className="chip bg-accent/10 text-accent">{p.bridge}</span>}
              </div>
              <p className="text-[15px] font-medium leading-relaxed">{p.question}</p>

              {done && mine ? (
                <div className="mt-2.5 rounded-xl bg-brand-50 px-3.5 py-2.5">
                  <p className="text-[14px] leading-relaxed text-brand-700">{mine.content}</p>
                  <button
                    className="mt-1.5 text-xs text-muted"
                    onClick={() => act({ action: 'removeInput', inputId: mine.id })}
                  >
                    重新回答
                  </button>
                </div>
              ) : (
                <div className="mt-2.5">
                  <textarea
                    className="field min-h-[86px] resize-none"
                    placeholder="想到什么就写什么，不用组织得很漂亮"
                    value={answers[p.id] ?? ''}
                    onChange={(e) => setAnswers({ ...answers, [p.id]: e.target.value })}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      className="btn-ghost px-3 py-1.5 text-xs"
                      disabled={busy || (answers[p.id] ?? '').trim().length < 2}
                      onClick={() => submitAnswer(p.id)}
                    >
                      提交这题
                    </button>
                    <Dictate
                      onText={(t) =>
                        setAnswers((prev) => ({ ...prev, [p.id]: joinDictation(prev[p.id] ?? '', t) }))
                      }
                      disabled={busy}
                      hint="说完自动填进这一题的答题框"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 评分区 */}
      <div className="mt-6">
        {(scoreResult || d.scores.length > 0) && (
          <ScoreCard
            total={scoreResult?.total ?? d.devotion.score}
            unlockScore={d.unlockScore}
            scores={scoreResult?.scores ?? d.scores}
            encouragement={scoreResult?.encouragement}
            degraded={scoreResult?.degraded}
          />
        )}

        {!unlocked ? (
          <>
            <button className="btn-primary mt-3 w-full py-3" onClick={evaluate} disabled={busy || !savedAnswers.length}>
              {busy ? '评估中…' : d.scores.length ? '修改后重新评估' : '提交，看看我想得怎么样'}
            </button>
            {!savedAnswers.length && (
              <p className="mt-2 text-center text-xs text-muted">先回答至少一道题</p>
            )}
          </>
        ) : (
          <button className="btn-primary mt-3 w-full py-3" onClick={() => act({ action: 'advance' })} disabled={busy}>
            已解锁 · 进入引导
          </button>
        )}
      </div>
    </div>
  );
}

function ScoreCard({
  total,
  unlockScore,
  scores,
  encouragement,
  degraded,
}: {
  total: number;
  unlockScore: number;
  scores: Score[];
  encouragement?: string;
  degraded?: boolean;
}) {
  const pass = total >= unlockScore;
  return (
    <div className="card px-4 py-4">
      <div className="mb-3 flex items-baseline gap-2">
        <span className={`text-[32px] font-semibold ${pass ? 'text-brand-500' : 'text-accent'}`}>{total}</span>
        <span className="text-xs text-muted">/ 100 · 解锁线 {unlockScore}</span>
        {degraded && <span className="chip ml-auto">离线评估</span>}
      </div>

      <div className="space-y-2.5">
        {scores.map((s) => (
          <div key={s.dimension}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted">{DIM_LABEL[s.dimension] ?? s.dimension}</span>
              <span className="tabular-nums text-ink">{s.score}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${s.score >= unlockScore ? 'bg-brand-500' : 'bg-accent/70'}`}
                style={{ width: `${Math.max(3, Math.min(100, s.score))}%` }}
              />
            </div>
            {s.reason && <p className="mt-1 text-[12px] leading-relaxed text-muted">{s.reason}</p>}
          </div>
        ))}
      </div>

      {encouragement && (
        <p className="mt-3 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-brand-700">
          {encouragement}
        </p>
      )}
      {!pass && (
        <p className="mt-3 text-[13px] leading-relaxed text-accent">
          还没到解锁线。这不是要难为你 —— 是因为现在给你答案，
          就把你自己能发现的那份夺走了。回上面再往里想一层。
        </p>
      )}
    </div>
  );
}

// ---------- 4. 引导揭晓 + 对话 ----------

function GuidedStage({ d, act, busy, reload }: StageProps) {
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState('');
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'writing' | 'done'>('idle');
  const [streamError, setStreamError] = useState('');
  const requested = useRef(false);
  const coachMsgs = d.coach;

  // 首次进入本阶段：用 SSE 逐字接收引导，避免干等 1-2 分钟
  useEffect(() => {
    if (coachMsgs.length || requested.current) return;
    requested.current = true;
    let cancelled = false;

    (async () => {
      setPhase('thinking');
      try {
        const res = await fetch(`/api/devotion/${d.devotion.id}/guide-stream`, { method: 'POST' });
        if (!res.ok || !res.body) {
          const info = await res.json().catch(() => ({ error: '引导生成失败' }));
          throw new Error(info.error ?? '引导生成失败');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            const event = JSON.parse(line.slice(5).trim());
            if (event.type === 'delta') {
              setPhase('writing');
              setStreaming((prev) => prev + event.text);
            } else if (event.type === 'error') {
              throw new Error(event.message);
            } else if (event.type === 'done') {
              setPhase('done');
            }
          }
        }
        if (!cancelled) await reload(); // 让落库后的消息进入正式列表
      } catch (err) {
        if (!cancelled) {
          setStreamError((err as Error).message);
          setPhase('idle');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coachMsgs.length, d.devotion.id, reload]);

  return (
    <div>
      <StageIntro title="同行者的回应">
        接下来的话是顺着你写的内容说的，不是标准答案。
        如果你不同意，就直接说出来 —— 那正是你自己在思考的证据。
      </StageIntro>

      {streamError && (
        <p className="mb-3 rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{streamError}</p>
      )}

      {phase === 'thinking' && !streaming && (
        <Waiting text="同行者正在读你写下的每一句…" expect="它在默想，通常 30-90 秒开始回应" />
      )}

      {/* 流式文本：还没落库前先显示这一份 */}
      {streaming && !coachMsgs.length && (
        <div className="card px-4 py-3.5">
          <p className="label mb-1.5">同行者</p>
          <div className="space-y-2">
            {streaming.split('\n').filter(Boolean).map((para, k) => (
              <p key={k} className="text-[14.5px] leading-[1.85] text-ink/90">
                {para}
              </p>
            ))}
          </div>
          {phase === 'writing' && (
            <span className="mt-1 inline-block h-4 w-[2px] animate-pulse bg-brand-500 align-middle" />
          )}
        </div>
      )}

      <div className="space-y-3">
        {coachMsgs.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'coach'
                ? 'card px-4 py-3.5'
                : 'ml-8 rounded-2xl bg-brand-500 px-4 py-3 text-white'
            }
          >
            {m.role === 'coach' && <p className="label mb-1.5">同行者</p>}
            <div className="space-y-2">
              {m.content.split('\n').filter(Boolean).map((para, k) => (
                <p key={k} className={`text-[14.5px] leading-[1.85] ${m.role === 'coach' ? 'text-ink/90' : ''}`}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(coachMsgs.length > 0 || phase === 'done') && (
        <div className="mt-4">
          <textarea
            className="field min-h-[86px] resize-none"
            placeholder="回应他的问题，或者说出你的不同意…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <Dictate onText={(t) => setText((prev) => joinDictation(prev, t))} disabled={busy} />
            <button
              className="btn-ghost flex-1"
              disabled={busy || text.trim().length < 2}
              onClick={async () => {
                const ok = await act({ action: 'coach', text: text.trim() });
                if (ok) setText('');
              }}
            >
              {busy ? '思考中…' : '继续对话'}
            </button>
            <button className="btn-primary flex-1" onClick={() => act({ action: 'advance' })} disabled={busy}>
              记生命实事
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 5. 生命实事 ----------

function LifeStage({ d, act, busy }: StageProps) {
  const [text, setText] = useState('');
  const facts = d.inputs.filter((i) => i.kind === 'life_fact');

  return (
    <div>
      <StageIntro title="记下你生命里的实事">
        灵修不是想法的练习，是生命的事。写一件<strong className="font-medium text-ink">真实发生过的事</strong>：
        这周你经历的、你看到的现象、让你难受或欣喜的那件具体的事。
        有了实事，等一下的祷告才有内容。
      </StageIntro>

      {facts.length > 0 && (
        <ul className="mb-3 space-y-2">
          {facts.map((f) => (
            <li key={f.id} className="card flex items-start gap-2 px-4 py-3">
              <p className="flex-1 text-[14px] leading-relaxed">{f.content}</p>
              <button className="text-xs text-muted" onClick={() => act({ action: 'removeInput', inputId: f.id })}>
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        className="field min-h-[120px] resize-none"
        placeholder="例如：这周和同事因为一件小事起了冲突，我表面客气，心里其实很想赢…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          className="btn-ghost px-3 py-1.5 text-xs"
          disabled={busy || text.trim().length < 5}
          onClick={async () => {
            const ok = await act({ action: 'input', kind: 'life_fact', content: text.trim() });
            if (ok) setText('');
          }}
        >
          添加
        </button>
        <Dictate onText={(t) => setText((prev) => joinDictation(prev, t))} disabled={busy} />
      </div>

      <NextButton gate={d.gate} busy={busy} onNext={() => act({ action: 'advance' })} label="下一步：祷告回应" />
    </div>
  );
}

// ---------- 6. 祷告 ----------

function PrayerStage({ d, act, busy }: StageProps) {
  const [text, setText] = useState('');
  const prayers = d.inputs.filter((i) => i.kind === 'prayer');
  const facts = d.inputs.filter((i) => i.kind === 'life_fact');

  return (
    <div>
      <StageIntro title="把话说回给神">
        到这里才是完整的一次灵修：你看见了、你问了、你想了、你想起自己的生命，
        现在把这些带到神面前说出来。
      </StageIntro>

      {facts.length > 0 && (
        <div className="card mb-4 bg-brand-50/60 px-4 py-3">
          <p className="label mb-1.5">你刚才写的实事</p>
          {facts.map((f) => (
            <p key={f.id} className="text-[13px] leading-relaxed text-brand-700">
              {f.content}
            </p>
          ))}
        </div>
      )}

      {prayers.length > 0 && (
        <ul className="mb-3 space-y-2">
          {prayers.map((p) => (
            <li key={p.id} className="card px-4 py-3">
              <p className="scripture text-[14.5px]">{p.content}</p>
              <button
                className="mt-1.5 text-xs text-muted"
                onClick={() => act({ action: 'removeInput', inputId: p.id })}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        className="field min-h-[140px] resize-none"
        placeholder="主啊…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          className="btn-ghost px-3 py-1.5 text-xs"
          disabled={busy || text.trim().length < 5}
          onClick={async () => {
            const ok = await act({ action: 'input', kind: 'prayer', content: text.trim() });
            if (ok) setText('');
          }}
        >
          保存祷告
        </button>
        <Dictate onText={(t) => setText((prev) => joinDictation(prev, t))} disabled={busy} hint="说出你的祷告，松开自动填进上面" />
      </div>

      <NextButton gate={d.gate} busy={busy} onNext={() => act({ action: 'complete' })} label="完成这次灵修" />
    </div>
  );
}

// ---------- 7. 完成卡片 ----------

function DoneStage({ d }: { d: Detail }) {
  const pick = (kind: string) => d.inputs.filter((i) => i.kind === kind);
  const sections: [string, Input[]][] = [
    ['我看见的', pick('observation')],
    ['我问的', pick('question')],
    ['我想的', pick('answer')],
    ['我的生命实事', pick('life_fact')],
    ['我的祷告', pick('prayer')],
  ];

  return (
    <div>
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl text-brand-500">
          ✓
        </div>
        <h2 className="text-[19px] font-semibold">这一次灵修完整了</h2>
        <p className="mt-1.5 text-sm text-muted">
          {d.passage.label} · 评估 {d.devotion.score} 分
          {d.devotion.completed_at ? ` · ${d.devotion.completed_at.slice(0, 10)}` : ''}
        </p>
      </div>

      <div className="space-y-3">
        {sections
          .filter(([, items]) => items.length)
          .map(([label, items]) => (
            <section key={label} className="card px-4 py-3.5">
              <p className="label mb-2">{label}</p>
              <div className="space-y-1.5">
                {items.map((i) => (
                  <p key={i.id} className="text-[14px] leading-relaxed text-ink/90">
                    {i.content}
                  </p>
                ))}
              </div>
            </section>
          ))}

        {d.coach.filter((m) => m.role === 'coach').length > 0 && (
          <section className="card px-4 py-3.5">
            <p className="label mb-2">同行者说过的话</p>
            {d.coach
              .filter((m) => m.role === 'coach')
              .map((m, i) => (
                <p key={i} className="mb-2 text-[13.5px] leading-relaxed text-muted">
                  {m.content}
                </p>
              ))}
          </section>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Link
          href={`/devotion?tab=explore&book=${d.devotion.book_id}&chapter=${d.devotion.chapter}`}
          className="btn-ghost flex-1"
        >
          看这章的图谱
        </Link>
        <Link href="/devotion?tab=read" className="btn-primary flex-1">
          继续读经
        </Link>
      </div>
    </div>
  );
}
