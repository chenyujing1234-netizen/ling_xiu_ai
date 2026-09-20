'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type DevotionInputRow = {
  id: number;
  kind: string;
  content: string;
  prompt_id?: number | null;
};

type SaveResult = { inputId?: number; inputs?: DevotionInputRow[] } | null;

export type AutoSaveTextOptions = {
  save: (payload: Record<string, unknown>) => Promise<SaveResult>;
  kind: string;
  minChars: number;
  promptId?: number;
  /** 保存成功后清空，便于连续写第二条（如至少提两个问题） */
  resetAfterSave?: boolean | ((kindCount: number) => boolean);
  /** 从服务端恢复未提交的草稿（如刷新后） */
  seed?: { id: number; content: string } | null;
};

const DEBOUNCE_MS = 650;

/** 灵修输入框：停笔片刻或失焦即保存，无需点「添加」 */
export function useAutoSaveDevotionText(opts: AutoSaveTextOptions) {
  const { save, kind, minChars, promptId, resetAfterSave, seed } = opts;
  const [text, setTextInternal] = useState(seed?.content ?? '');
  const draftIdRef = useRef<number | null>(seed?.id ?? null);
  const [draftId, setDraftId] = useState<number | null>(seed?.id ?? null);
  const lastSavedRef = useRef((seed?.content ?? '').trim());
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savingRef = useRef(false);

  useEffect(() => {
    if (seed?.id && draftIdRef.current == null) {
      draftIdRef.current = seed.id;
      setDraftId(seed.id);
      setTextInternal(seed.content);
      lastSavedRef.current = seed.content.trim();
    }
  }, [seed?.id, seed?.content]);

  const flush = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length < minChars || trimmed === lastSavedRef.current || savingRef.current) {
        return;
      }
      savingRef.current = true;
      try {
        const payload = draftIdRef.current
          ? { action: 'updateInput', inputId: draftIdRef.current, content: trimmed }
          : {
              action: 'input',
              kind,
              content: trimmed,
              ...(promptId != null ? { promptId } : {}),
            };
        const res = await save(payload);
        if (!res) return;

        lastSavedRef.current = trimmed;
        if (!draftIdRef.current && res.inputId) {
          draftIdRef.current = res.inputId;
          setDraftId(res.inputId);
        }

        const kindCount = res.inputs?.filter((i) => i.kind === kind).length ?? 0;
        const shouldReset =
          typeof resetAfterSave === 'function' ? resetAfterSave(kindCount) : Boolean(resetAfterSave);
        if (shouldReset) {
          setTextInternal('');
          draftIdRef.current = null;
          setDraftId(null);
          lastSavedRef.current = '';
        }
      } finally {
        savingRef.current = false;
      }
    },
    [save, kind, minChars, promptId, resetAfterSave],
  );

  const schedule = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(value), DEBOUNCE_MS);
    },
    [flush],
  );

  const setText = useCallback(
    (next: string | ((prev: string) => string)) => {
      setTextInternal((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        if (!value.trim()) {
          draftIdRef.current = null;
          setDraftId(null);
          lastSavedRef.current = '';
        }
        schedule(value);
        return value;
      });
    },
    [schedule],
  );

  const onBlur = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void flush(text);
  }, [flush, text]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { text, setText, onBlur, flushNow: () => flush(text), draftId };
}
