/** 灵修七步（客户端/服务端共用，避免 client 引用整份 devotion 逻辑） */
export const STAGES = ['observe', 'inquire', 'reflect', 'guided', 'life', 'prayer', 'done'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_META: Record<Stage, { title: string; hint: string }> = {
  observe: { title: '观察', hint: '先只写你看见的：谁、在哪里、什么时候、做了什么' },
  inquire: { title: '自己提问', hint: '不是回答问题，而是提出你自己的疑问' },
  reflect: { title: '默想作答', hint: '回答这些问题，用你自己的话' },
  guided: { title: '引导揭晓', hint: '陪读者顺着你写的内容，带你往深处走' },
  life: { title: '生命实事', hint: '记下你生命里真实发生的事、看到的现象' },
  prayer: { title: '祷告回应', hint: '把话说回给神，这次灵修才算完整' },
  done: { title: '完成', hint: '归档，可随时回看' },
};
