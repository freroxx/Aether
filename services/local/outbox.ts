/**
 * Offline outbox — 100% local, no tracking.
 * Mutations (homework done, news read, messages) are enqueued when
 * offline/failing and flushed on reconnect. Best-effort, MMKV-backed.
 */
import { getSimpleCache, setSimpleCache } from "@/services/shared/simple-cache";

export type OutboxKind =
  "homework-done" | "news-read" | "message-send" | "mail-create";

export type OutboxEntry = {
  id: string;
  kind: OutboxKind;
  createdAt: number;
  attempts: number;
  payload: Record<string, any>;
};

const OUTBOX_KEY = "outbox:v1";
const MAX_ATTEMPTS = 5;

function uid(): string {
  try {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    return String(Date.now());
  }
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  try {
    return (await getSimpleCache<OutboxEntry[]>(OUTBOX_KEY)) ?? [];
  } catch {
    return [];
  }
}

async function saveOutbox(entries: OutboxEntry[]): Promise<void> {
  // Keep 7 days max, 100 entries max — bounded, local only.
  const now = Date.now();
  const pruned = entries
    .filter(e => now - e.createdAt < 7 * 24 * 60 * 60 * 1000)
    .slice(-100);
  await setSimpleCache(OUTBOX_KEY, pruned, 7 * 24 * 60 * 60 * 1000);
}

export async function enqueueOutbox(
  kind: OutboxKind,
  payload: Record<string, any>
): Promise<OutboxEntry> {
  const entries = await getOutbox();
  const entry: OutboxEntry = {
    id: uid(),
    kind,
    createdAt: Date.now(),
    attempts: 0,
    payload,
  };
  entries.push(entry);
  await saveOutbox(entries);
  return entry;
}

export async function removeOutboxEntry(id: string): Promise<void> {
  const entries = await getOutbox();
  await saveOutbox(entries.filter(e => e.id !== id));
}

export async function bumpOutboxAttempt(id: string): Promise<void> {
  const entries = await getOutbox();
  const next = entries
    .map(e => (e.id === id ? { ...e, attempts: e.attempts + 1 } : e))
    .filter(e => e.attempts < MAX_ATTEMPTS);
  await saveOutbox(next);
}

/**
 * Flush outbox via provided handlers. Returns remaining count.
 * Handlers must throw on failure (entry kept + attempt bumped).
 */
export async function flushOutbox(
  handlers: Record<OutboxKind, (payload: Record<string, any>) => Promise<void>>
): Promise<number> {
  const entries = await getOutbox();
  for (const entry of entries) {
    const handler = handlers[entry.kind];
    if (!handler) {
      await removeOutboxEntry(entry.id);
      continue;
    }
    try {
      await handler(entry.payload);
      await removeOutboxEntry(entry.id);
    } catch {
      await bumpOutboxAttempt(entry.id);
    }
  }
  return (await getOutbox()).length;
}
