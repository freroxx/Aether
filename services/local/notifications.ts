import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { useSettingsStore } from "@/stores/settings";

/** Identifier (data kind) for the repeating tasks reminder. */
export const TASKS_REMINDER_ID = "tasks-reminder";
/** Identifier (data kind) for new-tasks alerts. */
export const NEW_TASKS_ID = "new-tasks";
/** Android notification channel id for homework reminders. */
export const TASKS_CHANNEL_ID = "tasks";

/** FR reminder variants. `{count}` is replaced with the undone count at schedule time. */
export const TASKS_SENTENCES: string[] = [
  "Tu as encore {count} tâches à faire !",
  "Allez, plus que {count} tâches à boucler !",
  "{count} devoirs t'attendent — courage !",
  "Petit rappel : {count} tâches restantes.",
  "Tes {count} devoirs n'attendent que toi !",
  "Encore {count} tâches et tu es tranquille !",
  "Ne lâche rien, il te reste {count} tâches à finir !",
];

/** Delay presets in minutes: 15 min → 7 j. */
export const DELAY_PRESETS: number[] = [15, 30, 60, 180, 720, 1440, 4320, 10080];

const PRESET_LABELS: Record<number, string> = {
  15: "15 min",
  30: "30 min",
  60: "1 h",
  180: "3 h",
  720: "12 h",
  1440: "24 h",
  4320: "3 j",
  10080: "7 j",
};

/** Humanize a delay in minutes (15 min, 30 min, 1 h, 3 h, 12 h, 24 h, 3 j, 7 j). */
export function formatDelay(min: number): string {
  if (PRESET_LABELS[min] !== undefined) return PRESET_LABELS[min];
  if (!Number.isFinite(min) || min <= 0) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 4320) {
    const h = min / 60;
    return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`;
  }
  const d = min / 1440;
  return Number.isInteger(d) ? `${d} j` : `${(Math.round(d * 10) / 10)} j`;
}

/** Snap an arbitrary minute value to the closest preset. */
export function snapToPreset(min: number): number {
  let best = DELAY_PRESETS[0];
  let bestDist = Math.abs(min - best);
  for (const p of DELAY_PRESETS) {
    const d = Math.abs(min - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureTasksChannel(): Promise<void> {
  try {
    if (Platform.OS !== "android") return;
    await Notifications.setNotificationChannelAsync(TASKS_CHANNEL_ID, {
      name: "Devoirs",
      importance: Notifications.AndroidImportance.MAX,
    });
  } catch {
    // best-effort
  }
}

function pickSentence(count: number): string {
  const raw =
    TASKS_SENTENCES[Math.floor(Math.random() * TASKS_SENTENCES.length)] ??
    TASKS_SENTENCES[0];
  return raw.replaceAll("{count}", String(Math.max(0, count)));
}

/** True when the OS permission is granted. */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.status === "granted";
  } catch {
    return false;
  }
}

/** Request OS permission, persist it to the store, return granted state. */
export async function requestNotificationsPermission(): Promise<boolean> {
  try {
    await ensureTasksChannel();
    const result = await Notifications.requestPermissionsAsync();
    const granted = result.status === "granted";
    try {
      const prev = useSettingsStore.getState().personalization;
      useSettingsStore.getState().mutateProperty("personalization", {
        notifications: { ...prev.notifications, permissionGranted: granted },
      });
    } catch {
      // store update best-effort
    }
    return granted;
  } catch {
    return false;
  }
}

/** Cancel the repeating tasks reminder (all scheduled requests tagged with TASKS_REMINDER_ID). */
export async function cancelTasksReminder(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const req of scheduled ?? []) {
      if ((req?.content?.data as { kind?: string } | undefined)?.kind === TASKS_REMINDER_ID) {
        try {
          await Notifications.cancelScheduledNotificationAsync(req.identifier);
        } catch {
          // ignore single cancel failure
        }
      }
    }
  } catch {
    // best-effort
  }
}

/**
 * (Re)schedule the repeating tasks reminder every `delayMin` minutes.
 * Cancels any existing reminder first. Body is a random FR sentence with
 * the current undone count resolved at schedule time.
 */
export async function scheduleTasksReminder(delayMin: number): Promise<void> {
  try {
    await ensureTasksChannel();
    const granted = await areNotificationsEnabled();
    if (!granted) return;

    await cancelTasksReminder();

    const safeDelayMin =
      Number.isFinite(delayMin) && delayMin > 0 ? delayMin : 120;
    // iOS requires >= 60s for repeating interval triggers.
    const seconds = Math.max(60, Math.round(safeDelayMin * 60));
    const count = await getUndoneTasksCount();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Aether — Devoirs",
        body: pickSentence(count),
        data: { kind: TASKS_REMINDER_ID },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
        ...(Platform.OS === "android" ? { channelId: TASKS_CHANNEL_ID } : {}),
      },
    });
  } catch {
    // best-effort
  }
}

interface HomeworkLike {
  id: string;
  isDone?: boolean;
}

/**
 * Test seam: override the homework source in isolated tests.
 * Default (`null`) uses lazy imports (manager → cache) to avoid cycles.
 */
export let __homeworkSourceForTests: null | (() => Promise<HomeworkLike[]>) =
  null;

export function __setHomeworkSourceForTests(
  src: null | (() => Promise<HomeworkLike[]>)
): void {
  __homeworkSourceForTests = src;
}

async function loadHomeworks(): Promise<HomeworkLike[]> {
  if (__homeworkSourceForTests) {
    try {
      return (await __homeworkSourceForTests()) ?? [];
    } catch {
      return [];
    }
  }
  try {
    const [{ getManager }, hwCache] = await Promise.all([
      import("@/services/shared"),
      import("@/database/useHomework"),
    ]);
    const week: number = hwCache.getWeekNumberFromDate(new Date());
    try {
      const manager = getManager();
      const homeworks = await manager?.getHomeworks(week);
      if (Array.isArray(homeworks) && homeworks.length > 0) {
        return homeworks as HomeworkLike[];
      }
    } catch {
      // fall through to cache
    }
    try {
      const cached = await hwCache.getHomeworksFromCache(week);
      if (Array.isArray(cached)) return cached as HomeworkLike[];
    } catch {
      // fall through
    }
    return [];
  } catch {
    return [];
  }
}

/** Number of undone homeworks for the current week (manager first, cache fallback, else 0). */
export async function getUndoneTasksCount(): Promise<number> {
  try {
    const homeworks = await loadHomeworks();
    return homeworks.filter(h => !h?.isDone).length;
  } catch {
    return 0;
  }
}

async function getCurrentTaskIds(): Promise<string[]> {
  try {
    const homeworks = await loadHomeworks();
    return homeworks.map(h => String(h?.id));
  } catch {
    return [];
  }
}

/**
 * 15-min new-task check: diff current homework IDs against the stored
 * `lastNotifiedTaskIds`. On new IDs → immediate "Nouveaux devoirs reçus !"
 * alert + persist the fresh ID list. First run only seeds the store.
 */
export async function checkNewTasksAndNotify(): Promise<void> {
  try {
    const state = useSettingsStore.getState();
    const prev: string[] =
      state.personalization.lastNotifiedTaskIds ??
      state.personalization.notifications?.lastNotifiedTaskIds ??
      [];
    const current = await getCurrentTaskIds();
    const fresh = current.filter(id => !prev.includes(id));

    try {
      state.mutateProperty("personalization", {
        lastNotifiedTaskIds: current,
        notifications: {
          ...state.personalization.notifications,
          lastNotifiedTaskIds: current,
        },
      });
    } catch {
      // store update best-effort
    }

    // Seed on first run: no baseline to diff against.
    if (prev.length === 0) return;
    if (fresh.length === 0) return;
    const granted = await areNotificationsEnabled();
    if (!granted) return;
    await ensureTasksChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Nouveaux devoirs reçus !",
        body:
          fresh.length === 1
            ? "Un nouveau devoir est arrivé."
            : `${fresh.length} nouveaux devoirs sont arrivés.`,
        data: { kind: NEW_TASKS_ID, count: fresh.length },
      },
      trigger: null,
    });
  } catch {
    // best-effort
  }
}

/** Re-apply the stored prefs (schedule or cancel). Used after cold start. */
export async function syncTasksReminderFromStore(): Promise<void> {
  try {
    const p = useSettingsStore.getState().personalization;
    const enabled = p.notificationsTasksEnabled ?? p.notifications?.tasksEnabled ?? false;
    if (!enabled) {
      await cancelTasksReminder();
      return;
    }
    const delay = p.notificationsTasksDelayMin ?? p.notifications?.tasksDelayMin ?? 120;
    await scheduleTasksReminder(delay);
  } catch {
    // best-effort
  }
}

// --- Legacy aliases (previous UI revision) ---

/** @deprecated Use {@link areNotificationsEnabled} instead. */
export const getNotificationPermissionGranted = areNotificationsEnabled;
/** @deprecated Use {@link requestNotificationsPermission} instead. */
export const requestTasksPermission = requestNotificationsPermission;

/** Immediate one-shot notification when new tasks are detected. */
export async function notifyNewTasks(count: number): Promise<string | null> {
  try {
    if (!Number.isFinite(count) || count <= 0) return null;
    const granted = await areNotificationsEnabled();
    if (!granted) return null;
    await ensureTasksChannel();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Nouveaux devoirs reçus !",
        body:
          count === 1
            ? "Un nouveau devoir est arrivé."
            : `${count} nouveaux devoirs sont arrivés.`,
        data: { kind: NEW_TASKS_ID, count },
      },
      trigger: null,
    });
    return id;
  } catch {
    return null;
  }
}

/** Poll `getPendingCount` every `intervalMs` (default 15min) and notify on increase. */
export function useNewTasksCheck(
  getPendingCount: () => Promise<number> | number,
  intervalMs = 15 * 60 * 1000,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    let lastCount = 0;
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      try {
        const p = useSettingsStore.getState().personalization;
        const tasksOn = p.notificationsTasksEnabled ?? p.notifications?.tasksEnabled ?? true;
        if (tasksOn === false) return;
        const count = await getPendingCount();
        if (!mounted || !Number.isFinite(count)) return;
        if (lastCount > 0 && count > lastCount) {
          await notifyNewTasks(count - lastCount);
        }
        lastCount = count;
      } catch {
        // best-effort, ignore
      }
    };

    poll();
    timer = setInterval(poll, intervalMs);
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [getPendingCount, intervalMs, enabled]);
}
