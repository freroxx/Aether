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
    };
  }
  return kv;
}

const DATE_MARKER = "$__date";

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

export async function getSimpleCache<T>(key: string): Promise<T | null> {
  try {
    const raw = getKV().getString(key);
    if (!raw) return null;
    return JSON.parse(raw, reviver) as T;
  } catch {
    return null;
  }
}

export async function setSimpleCache<T>(key: string, value: T): Promise<void> {
  try {
    getKV().set(key, JSON.stringify(value, replacer));
  } catch {
    // best-effort cache only
  }
}

export function simpleCacheKey(parts: Array<string | number | undefined>): string {
  return parts
    .map(p => (p === undefined ? "" : String(p)))
    .join(":");
}
