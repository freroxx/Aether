import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { useSettingsStore } from "@/stores/settings";
import type { TaskReminder } from "@/stores/settings/types";
import { TASKS_CHANNEL_ID } from "./notifications";

export const TASK_REMINDER_KIND = "task-reminder";

export type TaskRepeat = "none" | "hourly" | "bihourly";

function repeatSeconds(repeat: TaskRepeat | undefined): number | null {
  if (repeat === "hourly") return 60 * 60;
  if (repeat === "bihourly") return 2 * 60 * 60;
  return null;
}

function reminderId(homeworkId: string, remindAt: number, repeat?: TaskRepeat): string {
  return `task-reminder:${homeworkId}:${remindAt}:${repeat ?? "none"}`;
}

async function ensureChannel(): Promise<void> {
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

/** Construit le trigger : date unique ou intervalle répété (iOS exige >= 60s). */
function buildTrigger(remindAt: number, repeat: TaskRepeat | undefined): Notifications.NotificationTriggerInput {
  const seconds = repeatSeconds(repeat);
  const androidChannel = Platform.OS === "android" ? { channelId: TASKS_CHANNEL_ID } : {};
  if (seconds !== null) {
    return {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, seconds),
      repeats: true,
      ...androidChannel,
    } as Notifications.NotificationTriggerInput;
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(remindAt),
    ...androidChannel,
  } as Notifications.NotificationTriggerInput;
}

/** Planifie un rappel lié à une tâche (unique ou répété). Retourne le reminder. */
export async function scheduleTaskReminder(
  homeworkId: string,
  title: string,
  remindAt: number,
  repeat: TaskRepeat = "none",
): Promise<TaskReminder | null> {
  try {
    const granted = (await Notifications.getPermissionsAsync()).status === "granted";
    if (!granted) return null;
    await ensureChannel();
    const id = reminderId(homeworkId, remindAt, repeat);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Rappel — Devoir",
        body: title,
        data: { kind: TASK_REMINDER_KIND, id, homeworkId },
      },
      trigger: buildTrigger(remindAt, repeat),
    });
    const reminder: TaskReminder = {
      id,
      homeworkId,
      title,
      remindAt,
      repeat,
      enabled: true,
      createdAt: Date.now(),
    };
    const prev = useSettingsStore.getState().personalization.taskReminders ?? [];
    useSettingsStore.getState().mutateProperty("personalization", {
      taskReminders: [...prev.filter(r => r.id !== id), reminder],
    });
    return reminder;
  } catch {
    return null;
  }
}

/** Annule un rappel (OS + store). */
export async function cancelTaskReminder(id: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const req of scheduled ?? []) {
      if ((req?.content?.data as { id?: string } | undefined)?.id === id) {
        try {
          await Notifications.cancelScheduledNotificationAsync(req.identifier);
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // best-effort
  }
  try {
    const prev = useSettingsStore.getState().personalization.taskReminders ?? [];
    useSettingsStore.getState().mutateProperty("personalization", {
      taskReminders: prev.filter(r => r.id !== id),
    });
  } catch {
    // best-effort
  }
}

/** Active/désactive un rappel existant (reschedule si on). */
export async function setTaskReminderEnabled(id: string, enabled: boolean): Promise<void> {
  const prev = useSettingsStore.getState().personalization.taskReminders ?? [];
  const found = prev.find(r => r.id === id);
  if (!found) return;
  if (!enabled) {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const req of scheduled ?? []) {
        if ((req?.content?.data as { id?: string } | undefined)?.id === id) {
          try {
            await Notifications.cancelScheduledNotificationAsync(req.identifier);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // best-effort
    }
    useSettingsStore.getState().mutateProperty("personalization", {
      taskReminders: prev.map(r => (r.id === id ? { ...r, enabled: false } : r)),
    });
    return;
  }
  // Re-planifie
  try {
    const granted = (await Notifications.getPermissionsAsync()).status === "granted";
    if (!granted) return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Rappel — Devoir",
        body: found.title,
        data: { kind: TASK_REMINDER_KIND, id, homeworkId: found.homeworkId },
      },
      trigger: buildTrigger(found.remindAt, found.repeat),
    });
    useSettingsStore.getState().mutateProperty("personalization", {
      taskReminders: prev.map(r => (r.id === id ? { ...r, enabled: true } : r)),
    });
  } catch {
    // best-effort
  }
}

/** Re-planifie tous les rappels activés (au démarrage). */
export async function syncTaskRemindersFromStore(): Promise<void> {  try {
    const granted = (await Notifications.getPermissionsAsync()).status === "granted";
    if (!granted) return;
    const reminders = useSettingsStore.getState().personalization.taskReminders ?? [];
    const now = Date.now();
    for (const r of reminders) {
      if (!r.enabled) continue;
      const repeating = repeatSeconds(r.repeat) !== null;
      // One-shot passés : ignorés (sauf répétés, gérés par l'OS jusqu'à done)
      if (!repeating && r.remindAt <= now) continue;
      try {
        await ensureChannel();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Rappel — Devoir",
            body: r.title,
            data: { kind: TASK_REMINDER_KIND, id: r.id, homeworkId: r.homeworkId },
          },
          trigger: buildTrigger(r.remindAt, r.repeat),
        });
      } catch {
        // ignore single
      }
    }
  } catch {
    // best-effort
  }
}

/** Annule TOUS les rappels d'une tâche (ex: tâche marquée terminée). */
export async function cancelTaskRemindersForHomework(homeworkId: string): Promise<void> {
  const ids = new Set([homeworkId]);
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const prev = useSettingsStore.getState().personalization.taskReminders ?? [];
    const matching = prev.filter(r => ids.has(r.homeworkId));
    for (const req of scheduled ?? []) {
      const data = req?.content?.data as { kind?: string; id?: string; homeworkId?: string } | undefined;
      if (data?.kind !== TASK_REMINDER_KIND) continue;
      if (data.id && matching.some(r => r.id === data.id)) {
        try {
          await Notifications.cancelScheduledNotificationAsync(req.identifier);
        } catch {
          // ignore
        }
      } else if (data.homeworkId && ids.has(data.homeworkId)) {
        try {
          await Notifications.cancelScheduledNotificationAsync(req.identifier);
        } catch {
          // ignore
        }
      }
    }
    if (matching.length > 0) {
      useSettingsStore.getState().mutateProperty("personalization", {
        taskReminders: prev.filter(r => !ids.has(r.homeworkId)),
      });
    }
  } catch {
    // best-effort
  }
}
