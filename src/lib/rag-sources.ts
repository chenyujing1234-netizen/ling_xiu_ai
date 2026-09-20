/** book_rag 知识库引用（展示用） */
export type RagSource = { id: string; name: string };

export function parseRagSources(raw: string | null | undefined): RagSource[] {
  if (!raw?.trim()) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => {
        if (!x || typeof x !== 'object') return null;
        const id = String((x as RagSource).id ?? '').trim();
        const name = String((x as RagSource).name ?? '').trim();
        return id && name ? { id, name } : null;
      })
      .filter(Boolean) as RagSource[];
  } catch {
    return [];
  }
}

export function serializeRagSources(sources: RagSource[] | undefined | null): string | null {
  if (!sources?.length) return null;
  const uniq = [...new Map(sources.map((s) => [s.id, s])).values()];
  return JSON.stringify(uniq);
}

export function mergeRagSources(...lists: (RagSource[] | undefined | null)[]): RagSource[] {
  const map = new Map<string, RagSource>();
  for (const list of lists) {
    for (const s of list ?? []) {
      if (s?.id && s?.name) map.set(s.id, s);
    }
  }
  return [...map.values()];
}
