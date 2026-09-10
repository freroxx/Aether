import { create } from 'zustand'

import { Log, LogsStorage, NetworkStorage } from './types'

const MAX_LOGS = 200;
const MAX_REQUESTS_PER_HOST = 50;
const MAX_RESPONSES_PER_HOST = 50;
const MAX_HOSTS = 10;

export const useLogStore = create<LogsStorage>((set, get) => ({
  logs: [],
  // Ring buffer: cap to 200 entries to avoid unbounded memory growth.
  addItem: (log: Log) => set({ logs: [...get().logs, log].slice(-MAX_LOGS) })
}))

const sanitizeUrl = (rawUrl: string): string => {
  const url = new URL(rawUrl);
  return `${url.protocol}//${url.host}`;
};

export const useNetworkStore = create<NetworkStorage>((set, get) => ({
  hosts: new Map(),
  addRequest: (request: Request, uuid: string) => {
    const url = sanitizeUrl(request.url)
    const hosts = get().hosts;

    if (!hosts.has(url)) {
      // Evict oldest host when cap reached (Map preserves insertion order).
      if (hosts.size >= MAX_HOSTS) {
        const oldest = hosts.keys().next().value;
        if (oldest !== undefined) hosts.delete(oldest);
      }
      hosts.set(url, { requests: [], responses: [] });
    }

    const entry = hosts.get(url)!;
    entry.requests.push({ [uuid]: request });
    // Cap per-host history to avoid unbounded memory growth.
    if (entry.requests.length > MAX_REQUESTS_PER_HOST) {
      entry.requests = entry.requests.slice(-MAX_REQUESTS_PER_HOST);
    }

    set({ hosts: new Map(hosts) });
  },
  addResponse: (response: Response, uuid: string) => {
    const url = sanitizeUrl(response.url)
    const hosts = get().hosts;
    if (!hosts.has(url)) {
      // Evict oldest host when cap reached (Map preserves insertion order).
      if (hosts.size >= MAX_HOSTS) {
        const oldest = hosts.keys().next().value;
        if (oldest !== undefined) hosts.delete(oldest);
      }
      hosts.set(url, { requests: [], responses: [] });
    }
    const entry = hosts.get(url)!;
    entry.responses.push({ [uuid]: response });
    // Cap per-host history to avoid unbounded memory growth.
    if (entry.responses.length > MAX_RESPONSES_PER_HOST) {
      entry.responses = entry.responses.slice(-MAX_RESPONSES_PER_HOST);
    }
    set({ hosts: new Map(hosts) });
  }
}))