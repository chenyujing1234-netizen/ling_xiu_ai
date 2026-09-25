import type { RagSource } from '@/lib/rag-sources';

export default function RagSourcesFootnote({ sources }: { sources?: RagSource[] | null }) {
  if (!sources?.length) return null;
  const names = [...new Map(sources.map((s) => [s.id, s.name])).values()];
  return (
    <p className="mt-3 border-t border-line/70 pt-2.5 text-[11px] leading-relaxed text-muted">
      摘录自指定知识库：{names.join('、')}
    </p>
  );
}
