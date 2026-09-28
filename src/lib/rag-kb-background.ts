/**
 * 单节「圣经背景」固定检索的书库（book_rag / WeKnora）。
 *
 * ## 目录分析（共 93 个库，见 rag-kb-catalog.ts）
 *
 * | 分类 | 与「经节历史/文化背景」的关系 |
 * |------|------------------------------|
 * | bible | 经文文本，非背景叙述 |
 * | commentary | 逐卷注释，命中取决于是否在讲该卷；全库扫太慢且多数卷无对应注释 |
 * | creed / theology | 教义与要理，少时代地理社会史 |
 * | devotion / preaching / gospel | 灵修、讲道、福音，非背景资料 |
 * | life / care / culture | 现代生活、心理、当代文化，非古代近东/圣经时代 |
 * | history | **主战场**：犹太史、教会史、教父时代等 |
 *
 * history 类里「清教徒金句」「完全跟随神」偏语录/简介，背景密度低，不纳入固定列表。
 * commentary 里仅保留与**叙事史**强相关、常含年代与处境的两本作补充（使徒行传、列王）。
 *
 * 以后凡「查经节背景」，只检索 FIXED_BACKGROUND_RAG_KB_IDS，不再走管理员全库开关。
 */

import type { RagKbEntry } from './rag-kb-catalog';
import { ragKbById } from './rag-kb-catalog';

export const FIXED_BACKGROUND_RAG_KB_IDS: readonly string[] = [
  '083069f0-9c2c-482a-98ca-7ca3e19953a0', // 犹太古史 — 第二圣殿、罗马、犹太习俗，OT/NT 通用
  '500a7691-5fd3-4034-bf97-8d0772d3e36e', // 初代教会史 — 使徒时代教会与处境
  'b3b893c1-938f-41f8-bec6-64ff3f54ef80', // 基督大能两千年·早期教父 — 后使徒时代脉络
  '26640456-ae21-4f60-b1fa-9765ddc8d6c5', // 使徒行传讲义 — 路加叙事下的历史与地理
  '7a1f0f08-4253-4f25-8a8a-1606829c6ce0', // 三个国王的故事 — 以色列王国史背景
] as const;

export function backgroundRagKbEntries(): RagKbEntry[] {
  return FIXED_BACKGROUND_RAG_KB_IDS.map((id) => ragKbById(id)).filter(Boolean) as RagKbEntry[];
}

export function backgroundRagKbNames(): string[] {
  return FIXED_BACKGROUND_RAG_KB_IDS.map((id) => ragKbById(id)?.name ?? id);
}
