import { db } from './db';
import { RAG_KB_CATALOG, defaultRagKbIds, ragKbById } from './rag-kb-catalog';

const KEY = 'rag_kb_ids';

export async function ensureAppSettingsTable() {
  await db()
    .prepare(
      `CREATE TABLE IF NOT EXISTS app_settings (
         k VARCHAR(64) NOT NULL PRIMARY KEY,
         v TEXT NOT NULL,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    )
    .run();
}

export async function getEnabledRagKbIds(): Promise<string[]> {
  await ensureAppSettingsTable();
  const row = await db().prepare(`SELECT v FROM app_settings WHERE k = ?`).get<{ v: string }>(KEY);
  if (!row?.v) return defaultRagKbIds();
  try {
    const parsed = JSON.parse(row.v) as unknown;
    if (!Array.isArray(parsed)) return defaultRagKbIds();
    const ids = parsed.map((x) => String(x).trim()).filter(Boolean);
    return ids;
  } catch {
    return defaultRagKbIds();
  }
}

export async function setEnabledRagKbIds(ids: string[]): Promise<string[]> {
  await ensureAppSettingsTable();
  const known = new Set(RAG_KB_CATALOG.map((e) => e.id));
  const uniq = [...new Set(ids.map((x) => x.trim()).filter((id) => known.has(id) || id.length > 8))];
  const v = JSON.stringify(uniq);
  await db()
    .prepare(
      `INSERT INTO app_settings (k, v) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP`,
    )
    .run(KEY, v);
  return uniq;
}

export function namesOfKbIds(ids: string[]): string[] {
  return ids.map((id) => ragKbById(id)?.name ?? id);
}
