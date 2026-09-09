import { create } from "zustand";

interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: number;
  setSyncing: (v: boolean) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  isSyncing: false,
  lastSyncedAt: 0,
  setSyncing: (v: boolean) =>
    set((s) => ({
      isSyncing: v,
      lastSyncedAt: v ? s.lastSyncedAt : Date.now(),
    })),
}));
