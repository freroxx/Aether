/**
 * Per-device MMKV encryption key — 100% local, no tracking.
 * Legacy installs used a hardcoded key (obfuscation). New installs get a
 * random 32-byte key stored in expo-secure-store (hardware-backed on Android).
 * Sync callers use the in-memory cache; async init warms it on app start.
 */
let cachedKey: string | null = null;

// Legacy hardcoded key (existing installs) — kept only as fallback
// so current users don't lose their accounts on upgrade.
export const LEGACY_MMKV_KEY = "3f64fc8d-472d-43d5-ba11-461020e2423b";

export function getCachedEncryptionKey(): string | null {
  return cachedKey;
}

function randomKeyHex(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require("expo-crypto");
    const bytes = Crypto.getRandomBytes?.(32);
    if (bytes) {
      return Array.from(bytes as Uint8Array)
        .map(b => (b as number).toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // fall through to Math.random fallback
  }
  let out = "";
  for (let i = 0; i < 64; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export async function initSecureMMKVKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require("expo-secure-store");
    const stored = await SecureStore.getItemAsync("aether-mmkv-key");
    if (typeof stored === "string" && stored.length >= 16) {
      cachedKey = stored;
      return stored;
    }
    const fresh = randomKeyHex();
    try {
      await SecureStore.setItemAsync("aether-mmkv-key", fresh);
    } catch {
      // best-effort — keep in memory at least
    }
    cachedKey = fresh;
    return fresh;
  } catch {
    cachedKey = LEGACY_MMKV_KEY;
    return LEGACY_MMKV_KEY;
  }
}

/** Sync resolution for MMKV creation: secure key if warmed, else legacy. */
export function resolveMMKVKey(): string {
  return cachedKey ?? LEGACY_MMKV_KEY;
}
