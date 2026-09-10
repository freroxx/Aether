/**
 * Tiny MMKV-backed last-good cache for read-only data that has no
 * WatermelonDB model (evaluations, report, teaching staff).
 * Reuses the same `react-native-mmkv` instance pattern as `stores/global`.
 */

const memoryFallback = new Map<string, string>();

type KV = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  delete: (key: string) => void;
  getAllKeys?: () => string[];
};

let kv: KV | null = null;

function getKV(): KV {
  if (kv) return kv;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require("react-native-mmkv");
    const mmkv = createMMKV({ id: "aether-simple-cache" });
    kv = {
      getString: (key: string) => mmkv.getString(key),
      set: (key: string, value: string) => mmkv.set(key, value),
      delete: (key: string) => mmkv.delete(key),
      getAllKeys: () =>
        typeof mmkv.getAllKeys === "function" ? mmkv.getAllKeys() : [],
    };
  } catch {
    kv = {
      getString: (key: string) => memoryFallback.get(key),
      set: (key: string, value: string) => {
        memoryFallback.set(key, value);
      },
      delete: (key: string) => {
        memoryFallback.delete(key);
      },
      getAllKeys: () => [...memoryFallback.keys()],
    };
  }
  return kv;
}

const DATE_MARKER = "$__date";

const DEFAULT_TTL_MS = 300000; // 5min
const MAX_SIMPLE_CACHE_KEYS = 100;

// In-memory insertion order for LRU-ish eviction.
const keyInsertionOrder: string[] = [];

function trackKey(key: string): void {
  const idx = keyInsertionOrder.indexOf(key);
  if (idx !== -1) keyInsertionOrder.splice(idx, 1);
  keyInsertionOrder.push(key);
}

function evictIfNeeded(): void {
  try {
    const all = getAllKeys();
    if (all.length <= MAX_SIMPLE_CACHE_KEYS && keyInsertionOrder.length <= MAX_SIMPLE_CACHE_KEYS) return;
    const overflow = Math.max(
      all.length - MAX_SIMPLE_CACHE_KEYS,
      keyInsertionOrder.length - MAX_SIMPLE_CACHE_KEYS
    );
    for (let i = 0; i < overflow; i++) {
      const victim = keyInsertionOrder.shift() ?? all[i];
      if (victim === undefined) break;
      try {
        getKV().delete(victim);
      } catch {
        // best-effort
      }
    }
  } catch {
    // best-effort
  }
}

type Envelope = {
  value: unknown;
  expiresAt: number;
};

function isEnvelope(raw: unknown): raw is Envelope {
  return (
    raw !== null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    typeof (raw as Record<string, unknown>).expiresAt === "number" &&
    "value" in (raw as Record<string, unknown>)
  );
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return { [DATE_MARKER]: (value as Date).toISOString() };
  }
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 1 &&
    (value as Record<string, unknown>)[DATE_MARKER] !== undefined
  ) {
    const raw = (value as Record<string, unknown>)[DATE_MARKER];
    if (typeof raw === "string") {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return value;
}

export function getAllKeys(): string[] {
  try {
    const keys = getKV().getAllKeys?.();
    if (Array.isArray(keys)) return keys;
  } catch {
    // fall through
  }
  return [...memoryFallback.keys()];
}

export function getAllSimpleCacheKeys(): string[] {
  return getAllKeys();
}

export async function getSimpleCache<T>(key: string): Promise<T | null> {
  try {
    const raw = getKV().getString(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw, reviver);
    if (isEnvelope(parsed)) {
      if (Date.now() > parsed.expiresAt) {
        try {
          getKV().delete(key);
        } catch {
          // best-effort
        }
        return null;
      }
      return parsed.value as T;
    }
    // Legacy entry without envelope (pre-TTL): return as-is.
    return parsed as T;
  } catch {
    return null;
  }
}

export async function setSimpleCache<T>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  try {
    const envelope: Envelope = { value, expiresAt: Date.now() + ttlMs };
    getKV().set(key, JSON.stringify(envelope, replacer));
    trackKey(key);
    evictIfNeeded();
  } catch {
    // best-effort cache only
  }
}

export async function clearExpiredSimpleCache(): Promise<void> {
  try {
    const keys = getAllKeys();
    const now = Date.now();
    for (const key of keys) {
      try {
        const raw = getKV().getString(key);
        if (!raw) continue;
        const parsed: unknown = JSON.parse(raw, reviver);
        if (isEnvelope(parsed) && now > parsed.expiresAt) {
          getKV().delete(key);
          const idx = keyInsertionOrder.indexOf(key);
          if (idx !== -1) keyInsertionOrder.splice(idx, 1);
        }
      } catch {
        // ignore malformed entry
      }
    }
  } catch {
    // best-effort
  }
}

export async function clearSimpleCache(): Promise<void> {
  try {
    const keys = getAllKeys();
    for (const key of keys) {
      try {
        getKV().delete(key);
      } catch {
        // best-effort
      }
    }
    keyInsertionOrder.length = 0;
  } catch {
    // best-effort
  }
}

export function simpleCacheKey(parts: Array<string | number | undefined>): string {
  return parts
    .map(p => (p === undefined ? "" : String(p)))
    .join(":");
}
