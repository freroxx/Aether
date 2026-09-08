import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { useSettingsStore } from "@/stores/settings";
import type { TaskReminder } from "@/stores/settings/types";
import { TASKS_CHANNEL_ID } from "./notifications";

export const TASK_REMINDER_KIND = "task-reminder";

export type TaskRepeat = "none" | "hourly" | "bihourly";

/**
 * Canonical OS notification identifier for a homework's reminder.
 * Passed as `identifier` at schedule time (supported by the installed
 * expo-notifications@57 via `NotificationRequestInput.identifier`), so
 * cancel is exact: one `cancelScheduledNotificationAsync` call, no listing
 * scan needed. `content.data` still carries `{ kind, id, homeworkId }` so
 * pre-identifier schedules (random OS ids) keep matching by `data.id`.
 *
 * Note: one identifier per homework — scheduling a second reminder for the
 * same homework replaces the previous OS request (the store keeps both
 * entries; the latest schedule wins at OS level).
 */
export function taskNotificationIdentifier(homeworkId: string): string {
  return `aether:task:${homeworkId}`;
}

/** Exact cancel of a reminder's OS request + legacy `data.id` scan fallback. */
async function cancelOsNotificationForReminder(reminder: { id: string; homeworkId: string }): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(
      taskNotificationIdentifier(reminder.homeworkId),
    );
  } catch {
    // ignore: may not exist (already fired, denied, legacy schedule)
  }
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const req of scheduled ?? []) {
      if ((req?.content?.data as { id?: string } | undefined)?.id === reminder.id) {
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
  // Garde past-date : une DATE passée part immédiatement (ou échoue) selon
  // l'OS — clamp à now+60s minimum (règle iOS 60s).
  const requestedAt = Number.isFinite(remindAt) && remindAt > 0 ? remindAt : Date.now() + 60_000;
  const safeAt = Math.max(requestedAt, Date.now() + 60_000);
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(safeAt),
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
      identifier: taskNotificationIdentifier(homeworkId),
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
    const prev = useSettingsStore.getState().personalization.taskReminders ?? [];
    const found = prev.find(r => r.id === id);
    if (found) {
      await cancelOsNotificationForReminder(found);
    } else {
      // Entrée store déjà absente : repli legacy par data.id.
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
    await cancelOsNotificationForReminder(found);
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
      identifier: taskNotificationIdentifier(found.homeworkId),
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

/**
 * Index live des devoirs (manager, semaine courante — schémas `id` et
 * route-id) pour la purge. `reliable` = le manager a répondu (données
 * fraîches). La DB est interrogée par rappel dans {@link homeworkExists}.
 */
async function buildHomeworkExistenceIndex(): Promise<{
  ids: Set<string>;
  reliable: boolean;
}> {
  const ids = new Set<string>();
  try {
    const [{ getManager }, hwCache] = await Promise.all([
      import("@/services/shared"),
      import("@/database/useHomework"),
    ]);
    const manager = getManager();
    const list = await manager?.getHomeworks(
      hwCache.getWeekNumberFromDate(new Date()),
    );
    if (Array.isArray(list)) {
      for (const h of list as unknown as Array<Record<string, unknown>>) {
        const raw = h["id"];
        if (raw !== undefined && raw !== null) ids.add(String(raw));
        try {
          ids.add(
            hwCache.getHomeworkRouteId(
              h as unknown as Parameters<typeof hwCache.getHomeworkRouteId>[0],
            ),
          );
        } catch {
          // ligne inattendue : ignorée
        }
      }
      return { ids, reliable: true };
    }
  } catch {
    // manager/cache indisponible : index vide, non fiable
  }
  return { ids, reliable: false };
}

/** Existence d'un devoir : DB (toutes semaines) puis index live. `null` = inconnu → conserver. */
async function homeworkExists(
  homeworkId: string,
  live: { ids: Set<string>; reliable: boolean },
): Promise<boolean | null> {
  const key = String(homeworkId);
  if (live.ids.has(key)) return true;
  try {
    const { getHomeworkById } = await import("@/database/useHomework");
    const found = await getHomeworkById(key);
    if (found !== undefined) return true;
  } catch {
    return null; // DB indisponible → inconnu, on conserve
  }
  // Absent DB + présent live ? déjà testé ci-dessus. Absent des deux avec des
  // données manager fraîches → n'existe plus ; sans données fraîches → inconnu.
  if (live.reliable) return false;
  return null;
}

/** Re-planifie tous les rappels activés (au démarrage). */
export async function syncTaskRemindersFromStore(): Promise<void> {
  try {
    const store = useSettingsStore.getState();
    const reminders = store.personalization.taskReminders ?? [];
    const now = Date.now();

    // Purge (hygiène store, sans permission requise) :
    // - one-shots dont remindAt <= now (ne sonneront plus jamais) ;
    // - rappels dont le devoir n'existe plus (que si l'existence a pu être
    //   vérifiée — jamais de purge sur infra indisponible).
    const live = await buildHomeworkExistenceIndex();
    const kept: TaskReminder[] = [];
    const purged: TaskReminder[] = [];
    for (const r of reminders) {
      const repeating = repeatSeconds(r.repeat) !== null;
      if (!repeating && r.remindAt <= now) {
        purged.push(r);
        continue;
      }
      const exists = await homeworkExists(r.homeworkId, live);
      if (exists === false) {
        purged.push(r);
        continue;
      }
      kept.push(r);
    }
    if (purged.length > 0) {
      for (const r of purged) {
        try {
          await cancelOsNotificationForReminder(r);
        } catch {
          // ignore single
        }
      }
      try {
        store.mutateProperty("personalization", { taskReminders: kept });
      } catch {
        // best-effort
      }
    }

    const granted = (await Notifications.getPermissionsAsync()).status === "granted";
    if (!granted) return;
    await ensureChannel();
    for (const r of kept) {
      if (!r.enabled) continue;
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: taskNotificationIdentifier(r.homeworkId),
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
    // Annulation exacte via l'identifiant canonique (planifications récentes).
    try {
      await Notifications.cancelScheduledNotificationAsync(
        taskNotificationIdentifier(homeworkId),
      );
    } catch {
      // ignore: peut ne pas exister
    }
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
