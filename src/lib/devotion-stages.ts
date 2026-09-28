/** 灵修七步（客户端/服务端共用，避免 client 引用整份 devotion 逻辑） */
export const STAGES = ['observe', 'inquire', 'reflect', 'guided', 'life', 'prayer', 'done'] as const;
export type Stage = (typeof STAGES)[number];

/** 合并默想页：观察 + 提问 + 作答（库内仍保留细分 stage，便于旧会话兼容） */
export const PREP_STAGES: Stage[] = ['observe', 'inquire', 'reflect'];

export function isPrepStage(stage: Stage) {
  return PREP_STAGES.includes(stage);
}

/** 灵修页仅「一起默想」单页；库内 guided/life/prayer 视为旧数据，仍走同一页 */
export function isCombinedDevotionUi(stage: Stage) {
  return isPrepStage(stage) || stage === 'guided' || stage === 'life' || stage === 'prayer';
}

export const STAGE_META: Record<Stage, { title: string; hint: string }> = {
  observe: { title: '一起默想', hint: '在同一页写下看见的、想问的，并完成默想作答' },
  inquire: { title: '一起默想', hint: '在同一页写下看见的、想问的，并完成默想作答' },
  reflect: { title: '一起默想', hint: '在同一页写下看见的、想问的，并完成默想作答' },
  guided: { title: '引导揭晓', hint: '陪读者顺着你写的内容，带你往深处走' },
  life: { title: '生命实事', hint: '记下你生命里真实发生的事、看到的现象' },
  prayer: { title: '祷告回应', hint: '把话说回给神，这次灵修才算完整' },
  done: { title: '完成', hint: '归档，可随时回看' },
};
