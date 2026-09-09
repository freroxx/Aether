import { create } from "zustand";

interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: number;
  /** Incrémenté à chaque switch compte/enfant : invalide tous les caches UI. */
  accountEpoch: number;
  setSyncing: (v: boolean) => void;
  bumpAccountEpoch: () => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  isSyncing: false,
  lastSyncedAt: 0,
  accountEpoch: 0,
  setSyncing: (v: boolean) =>
    set((s) => ({
      isSyncing: v,
      lastSyncedAt: v ? s.lastSyncedAt : Date.now(),
    })),
  bumpAccountEpoch: () => set((s) => ({ accountEpoch: s.accountEpoch + 1 })),
}));
