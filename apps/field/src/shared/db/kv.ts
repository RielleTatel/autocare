import { getDb } from "./schema";

export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
  return r?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", key, value);
}
