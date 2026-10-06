import type { RagSource } from '@/lib/rag-sources';

export default function RagSourcesFootnote({
  sources,
  label = '摘录自指定知识库',
}: {
  sources?: RagSource[] | null;
  label?: string;
}) {
  if (!sources?.length) return null;
  const names = [...new Map(sources.map((s) => [s.id, s.name])).values()];
  return (
    <p className="mt-3 border-t border-line/70 pt-2.5 text-[11px] leading-relaxed text-muted">
      {label}：{names.join('、')}
    </p>
  );
}
