import * as Network from "expo-network";

let cached: boolean | null = null;
let subscribed = false;

function applyState(state: { isInternetReachable?: boolean | null; isConnected?: boolean | null }): void {
  if (state.isInternetReachable !== undefined && state.isInternetReachable !== null) {
    cached = state.isInternetReachable;
  } else if (state.isConnected !== undefined && state.isConnected !== null) {
    cached = state.isConnected;
  }
}

function ensureSubscribed(): void {
  if (subscribed) return;
  subscribed = true;
  try {
    Network.addNetworkStateListener((event: { isInternetReachable?: boolean | null; isConnected?: boolean | null }) => {
      applyState(event);
    });
    Network.getNetworkStateAsync()
      .then(state => applyState(state))
      .catch(() => {});
  } catch {}
}

export async function hasInternet(): Promise<boolean> {
  ensureSubscribed();
  if (cached !== null) return cached;
  try {
    const state = await Network.getNetworkStateAsync();
    const value = state.isInternetReachable ?? state.isConnected ?? null;
    if (value !== null && value !== undefined) {
      cached = value;
      return value;
    }
  } catch {}
  // Offline-first: when the OS can't tell us, assume offline so callers
  // prefer cache/fallback instead of firing doomed network requests.
  return false;
}

export function getCachedNetworkState(): boolean | null {
  return cached;
}

export function __resetNetworkCacheForTests(): void {
  cached = null;
  subscribed = false;
}
