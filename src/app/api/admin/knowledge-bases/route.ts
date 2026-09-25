import { z } from 'zod';
import { handler, body } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { listKnowledgeBases } from '@/lib/book-rag';
import {
  RAG_KB_CATALOG,
  RAG_KB_CATEGORY_LABEL,
  RAG_KB_CATEGORY_ORDER,
  ragKbById,
} from '@/lib/rag-kb-catalog';
import { getEnabledRagKbIds, setEnabledRagKbIds } from '@/lib/rag-kb-settings';

export async function GET() {
  return handler(async () => {
    await requireAdmin();
    const [live, enabled] = await Promise.all([listKnowledgeBases(true), getEnabledRagKbIds()]);
    const liveMap = new Map(live.map((k) => [k.id, k]));
    const enabledSet = new Set(enabled);

    const items = RAG_KB_CATALOG.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      categoryLabel: RAG_KB_CATEGORY_LABEL[e.category],
      why: e.why,
      enabled: enabledSet.has(e.id),
      online: liveMap.has(e.id),
      liveName: liveMap.get(e.id)?.name ?? null,
    }));

    const extra = live
      .filter((k) => !ragKbById(k.id))
      .map((k) => ({
        id: k.id,
        name: k.name,
        category: 'other' as const,
        categoryLabel: '未纳入默认检索',
        why: '书库里有、默认不搜（商业/测试等）',
        enabled: enabledSet.has(k.id),
        online: true,
        liveName: k.name,
      }));

    return {
      configured: live.length > 0,
      categories: RAG_KB_CATEGORY_ORDER.map((id) => ({ id, label: RAG_KB_CATEGORY_LABEL[id] })),
      items: [...items, ...extra],
      enabledCount: items.filter((i) => i.enabled).length,
      catalogCount: RAG_KB_CATALOG.length,
    };
  });
}

const Patch = z.object({
  ids: z.array(z.string().min(1)).max(200),
});

export async function PATCH(req: Request) {
  return handler(async () => {
    await requireAdmin();
    const data = await body(req, Patch);
    const ids = await setEnabledRagKbIds(data.ids);
    return { ok: true, ids, enabledCount: ids.length };
  });
}
