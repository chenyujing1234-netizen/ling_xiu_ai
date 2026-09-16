'use client';

import { useMemo, useRef } from 'react';
import { svgToPng } from '@/lib/svg-export';

export type MindmapNode = { label: string; children?: MindmapNode[] };

type Laid = {
  label: string;
  depth: number;
  x: number;
  y: number;
  width: number;
  parent?: Laid;
};

const COL_W = [190, 210, 230];
const ROW_H = 40;
const PAD_X = 24;
const PAD_Y = 32;

/** 从右向左展开的横向树布局：叶子按顺序占行，父节点居中于子节点之间 */
function layout(root: MindmapNode) {
  const nodes: Laid[] = [];
  let row = 0;

  const walk = (node: MindmapNode, depth: number, parent?: Laid): Laid => {
    const x = PAD_X + COL_W.slice(0, depth).reduce((a, b) => a + b, 0);
    const width = charWidth(node.label);
    const self: Laid = { label: node.label, depth, x, y: 0, width, parent };

    if (!node.children?.length) {
      self.y = PAD_Y + row * ROW_H;
      row += 1;
    } else {
      const kids = node.children.map((c) => walk(c, depth + 1, self));
      self.y = (kids[0].y + kids[kids.length - 1].y) / 2;
    }
    nodes.push(self);
    return self;
  };

  walk(root, 0);
  const height = PAD_Y * 2 + Math.max(1, row) * ROW_H;
  const width =
    PAD_X * 2 + Math.max(...nodes.map((n) => n.x + n.width - PAD_X)) + 20;
  return { nodes, width: Math.max(560, width), height: Math.max(240, height) };
}

/** 中文按全宽估算，避免文字溢出圆角框 */
function charWidth(text: string) {
  const units = Array.from(text).reduce((n, ch) => n + (/[\u4e00-\u9fa5]/.test(ch) ? 13 : 7.2), 0);
  return Math.min(200, units + 22);
}

const DEPTH_STYLE = [
  { fill: '#8a6d3b', text: '#ffffff', size: 13.5, weight: 600 },
  { fill: '#e6dfcd', text: '#5c4826', size: 12.5, weight: 500 },
  { fill: '#fffdf8', text: '#2c2620', size: 12, weight: 400 },
];

export default function Mindmap({ data, title }: { data: MindmapNode; title: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { nodes, width, height } = useMemo(() => layout(data), [data]);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card no-bar">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: width }}
        >
          <rect width={width} height={height} fill="#fbf8f1" />

          {/* 连线：贝塞尔曲线，从父节点右侧连到子节点左侧 */}
          <g>
            {nodes
              .filter((n) => n.parent)
              .map((n, i) => {
                const p = n.parent!;
                const x1 = p.x + p.width;
                const y1 = p.y;
                const x2 = n.x;
                const y2 = n.y;
                const mid = (x1 + x2) / 2;
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#c2ab7f"
                    strokeWidth={n.depth === 1 ? 1.6 : 1.1}
                    strokeOpacity={0.7}
                  />
                );
              })}
          </g>

          {/* 节点 */}
          <g>
            {nodes.map((n, i) => {
              const style = DEPTH_STYLE[Math.min(n.depth, 2)];
              return (
                <g key={i}>
                  <rect
                    x={n.x}
                    y={n.y - 13}
                    width={n.width}
                    height={26}
                    rx={13}
                    fill={style.fill}
                    stroke={n.depth === 2 ? '#e8e0d4' : 'none'}
                  />
                  <text
                    x={n.x + n.width / 2}
                    y={n.y + 4}
                    fontSize={style.size}
                    fontWeight={style.weight}
                    fill={style.text}
                    textAnchor="middle"
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted">可左右拖动查看完整导图</p>
        <button
          className="btn-ghost px-3 py-1.5 text-xs"
          onClick={() => svgRef.current && svgToPng(svgRef.current, `思维导图-${title}.png`)}
        >
          导出图片
        </button>
      </div>
    </div>
  );
}
