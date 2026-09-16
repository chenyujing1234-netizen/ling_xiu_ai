'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { svgToPng } from '@/lib/svg-export';

export type GraphData = {
  nodes: { id: string; label: string; type: string; note?: string }[];
  edges: { from: string; to: string; label: string; weight?: number }[];
};

type SimNode = GraphData['nodes'][number] & { x: number; y: number; fx?: number; fy?: number };
type SimLink = { source: SimNode; target: SimNode; label: string; weight: number };

const TYPE_STYLE: Record<string, { fill: string; stroke: string; label: string }> = {
  person: { fill: '#e8dcc4', stroke: '#8a6d3b', label: '人物' },
  place: { fill: '#d8e4d4', stroke: '#5b7a55', label: '地点' },
  event: { fill: '#f0dcd2', stroke: '#9c5b3f', label: '事件' },
  time: { fill: '#dfe2ec', stroke: '#5a6382', label: '时间' },
  theme: { fill: '#f5e6b8', stroke: '#a8862c', label: '主题' },
};

const W = 720;
const H = 560;

export default function KnowledgeGraph({ data, title }: { data: GraphData; title: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const [active, setActive] = useState<SimNode | null>(null);

  // 力导向布局：跑固定步数后定格，避免手机上持续动画耗电
  const layout = useMemo(() => {
    const simNodes: SimNode[] = data.nodes.map((n, i) => ({
      ...n,
      // 初始按圆周铺开，收敛更快也更均匀
      x: W / 2 + Math.cos((i / data.nodes.length) * Math.PI * 2) * 180,
      y: H / 2 + Math.sin((i / data.nodes.length) * Math.PI * 2) * 180,
    }));
    const byId = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = data.edges
      .map((e) => ({
        source: byId.get(e.from)!,
        target: byId.get(e.to)!,
        label: e.label,
        weight: e.weight ?? 1,
      }))
      .filter((l) => l.source && l.target);

    const sim = forceSimulation(simNodes)
      .force('link', forceLink(simLinks).distance(130).strength(0.5))
      .force('charge', forceManyBody().strength(-620))
      .force('center', forceCenter(W / 2, H / 2))
      .force('collide', forceCollide(46))
      .stop();
    sim.tick(320);

    // 收进画布，留出边距
    const pad = 56;
    for (const n of simNodes) {
      n.x = Math.max(pad, Math.min(W - pad, n.x));
      n.y = Math.max(pad, Math.min(H - pad, n.y));
    }
    return { simNodes, simLinks };
  }, [data]);

  useEffect(() => {
    setNodes(layout.simNodes);
    setLinks(layout.simLinks);
  }, [layout]);

  const usedTypes = Array.from(new Set(data.nodes.map((n) => n.type))).filter((t) => TYPE_STYLE[t]);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card no-bar">
        <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="min-w-[720px]">
          <rect width={W} height={H} fill="#fbf8f1" />
          <text x={20} y={30} fontSize={15} fontWeight={600} fill="#2c2620">
            {title}
          </text>

          {/* 关系线 */}
          <g>
            {links.map((l, i) => (
              <g key={i}>
                <line
                  x1={l.source.x}
                  y1={l.source.y}
                  x2={l.target.x}
                  y2={l.target.y}
                  stroke="#c2ab7f"
                  strokeWidth={0.8 + l.weight * 0.5}
                  strokeOpacity={0.55}
                />
                {l.label && (
                  <text
                    x={(l.source.x + l.target.x) / 2}
                    y={(l.source.y + l.target.y) / 2 - 4}
                    fontSize={10}
                    fill="#8a8078"
                    textAnchor="middle"
                  >
                    {l.label}
                  </text>
                )}
              </g>
            ))}
          </g>

          {/* 节点 */}
          <g>
            {nodes.map((n) => {
              const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.event;
              const r = n.type === 'theme' ? 34 : 28;
              return (
                <g
                  key={n.id}
                  onClick={() => setActive(active?.id === n.id ? null : n)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    fill={style.fill}
                    stroke={active?.id === n.id ? '#9c5b3f' : style.stroke}
                    strokeWidth={active?.id === n.id ? 2.5 : 1.4}
                  />
                  <text
                    x={n.x}
                    y={n.y + 4}
                    fontSize={n.label.length > 4 ? 10 : 12}
                    fill="#2c2620"
                    textAnchor="middle"
                  >
                    {n.label.length > 6 ? `${n.label.slice(0, 6)}…` : n.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* 图例 */}
          <g transform={`translate(20, ${H - 22})`}>
            {usedTypes.map((t, i) => (
              <g key={t} transform={`translate(${i * 74}, 0)`}>
                <circle cx={6} cy={-4} r={6} fill={TYPE_STYLE[t].fill} stroke={TYPE_STYLE[t].stroke} />
                <text x={17} y={0} fontSize={11} fill="#8a8078">
                  {TYPE_STYLE[t].label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {active && (
        <div className="card mt-3 px-4 py-3">
          <p className="text-[15px] font-medium">
            {active.label}
            <span className="ml-2 text-xs text-muted">{TYPE_STYLE[active.type]?.label ?? active.type}</span>
          </p>
          {active.note && <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{active.note}</p>}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted">点节点看说明 · 可左右拖动查看</p>
        <button
          className="btn-ghost px-3 py-1.5 text-xs"
          onClick={() => svgRef.current && svgToPng(svgRef.current, `知识图谱-${title}.png`)}
        >
          导出图片
        </button>
      </div>
    </div>
  );
}
