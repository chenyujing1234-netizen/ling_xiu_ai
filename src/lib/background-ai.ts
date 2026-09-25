/** 灵修 action 中会调用 LLM 的类型 */
export const DEVOTION_AI_ACTIONS = new Set(['prompts', 'score', 'guide', 'coach', 'advance']);

export const DEVOTION_AI_LABELS: Record<string, string> = {
  prompts: '默想思考题',
  score: '默想评估',
  guide: '引导生成',
  coach: '陪读者回应',
  advance: '阶段点评',
};

export function insightsAiLabel(kind: string): string {
  const map: Record<string, string> = {
    elements: '要素梳理',
    graph: '知识图谱',
    mindmap: '思维导图',
    image: '意境配图',
    context: '上下文分析',
  };
  return map[kind] ?? '经文洞察';
}
