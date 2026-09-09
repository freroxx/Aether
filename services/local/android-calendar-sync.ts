import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import type { Course } from '@/services/shared/timetable';
import { useAccountStore } from '@/stores/account';
import { useSettingsStore } from '@/stores/settings';
import { error, log } from '@/utils/logger/logger';
import { hasCalendarPermissions } from './android-calendar';

export const AETHER_CALENDAR_TITLE = 'Aether';
/** Fenêtre miroir : aujourd'hui -> +7 jours (ex: activé le 8 sept. -> jusqu'au 15). */
export const SYNC_WINDOW_DAYS = 7;

export function exportChildKey(accountId: string, childName?: string): string {
  return `${accountId}::${childName ?? ""}`;
}

export function getExportTarget(): { accountId: string; childName?: string } | null {
  const t = useSettingsStore.getState().personalization.androidCalendarExportTarget;
  return t ?? null;
}

function calendarTitleFor(childName?: string): string {
  return childName ? `Aether – ${childName}` : AETHER_CALENDAR_TITLE;
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function windowEnd(): Date {
  const d = todayStart();
  d.setDate(d.getDate() + SYNC_WINDOW_DAYS);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Retourne l'id du calendrier dédié, le crée si besoin.
 * Sans argument : cible d'export unique (ou legacy global). */
export async function ensureAetherCalendar(childKey?: string, childName?: string): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  if (!Calendar?.getCalendarsAsync || !Calendar?.createCalendarAsync) return null;

  const mutate = useSettingsStore.getState().mutateProperty;

  // 1. Vérifie les permissions, sinon les demande (calendrier + rappels).
  let granted = await hasCalendarPermissions();
  if (!granted) {
    try {
      const calReq = await (Calendar as any)?.requestCalendarPermissionsAsync?.();
      if (calReq && typeof calReq.status === 'string') {
        granted = calReq.status === 'granted';
      }
    } catch (e) {
      error('ensureAetherCalendar requestCalendar: ' + String(e));
    }
    // Rappels : best-effort, ne bloque pas l'export.
    try {
      await (Calendar as any)?.requestRemindersPermissionsAsync?.();
    } catch {
      // best-effort
    }
    if (!granted) {
      try {
        granted = await hasCalendarPermissions();
      } catch {
        granted = false;
      }
    }
  }
  if (!granted) {
    throw new Error(
      "Permission calendrier refusée : active l'accès au calendrier dans les réglages pour utiliser « Exporter mes cours »."
    );
  }

  try {
    const prefs = useSettingsStore.getState().personalization;
    const target = getExportTarget();
    const key = childKey ?? (target ? exportChildKey(target.accountId, target.childName) : undefined);
    const label = childName ?? target?.childName;
    const title = calendarTitleFor(label);
    const storedByChild = key ? prefs.aetherCalendarIdByChild?.[key] : undefined;
    // 2. Réutilise l'id stocké s'il existe encore sur l'appareil.
    const stored = storedByChild ?? prefs.aetherCalendarId;
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (stored) {
      const found = (calendars || []).find(c => String(c.id) === stored);
      if (found) {
        // Migration legacy -> slot par enfant.
        if (key && !storedByChild) {
          mutate('personalization', {
            aetherCalendarIdByChild: { ...(prefs.aetherCalendarIdByChild ?? {}), [key]: stored },
          });
        }
        return stored;
      }
    }
    // 3. Fallback : cherche un calendrier intitulé « Aether » ou « Aether – Enfant ».
    const existing = (calendars || []).find(c => c.title === title)
      ?? (label ? (calendars || []).find(c => c.title === AETHER_CALENDAR_TITLE) : undefined);
    if (existing) {
      const id = String(existing.id);
      if (key) {
        mutate('personalization', {
          aetherCalendarIdByChild: { ...(useSettingsStore.getState().personalization.aetherCalendarIdByChild ?? {}), [key]: id },
          aetherCalendarId: id,
        });
      } else {
        mutate('personalization', { aetherCalendarId: id });
      }
      return id;
    }
    // Crée le calendrier sur la première source locale/disponible
    const first = (calendars || [])[0];
    const source = first?.source;
    const id = await Calendar.createCalendarAsync({
      title,
      color: '#29947A',
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: source?.id,
      source,
      name: title,
      ownerAccount: 'Aether',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    const idStr = String(id);
    if (key) {
      mutate('personalization', {
        aetherCalendarIdByChild: { ...(useSettingsStore.getState().personalization.aetherCalendarIdByChild ?? {}), [key]: idStr },
        aetherCalendarId: idStr,
      });
    } else {
      mutate('personalization', { aetherCalendarId: idStr });
    }
    log('Aether device calendar created: ' + idStr);
    return idStr;
  } catch (e) {
    // Propage les refus de permission avec un message FR lisible.
    if (e instanceof Error && e.message.includes('Permission calendrier refusée')) {
      throw e;
    }
    error('ensureAetherCalendar: ' + String(e));
    return null;
  }
}

function eventDetails(course: Course): { title: string; location?: string; notes?: string } {
  const kid = (course as any)?.kidName;
  const lines = [`Aether · ${course.subject || 'Cours'}`, course.teacher ?? '', course.room ?? ''];
  if (typeof kid === "string" && kid.length > 0) lines.unshift(`Enfant : ${kid}`);
  return {
    title: course.subject || 'Cours',
    location: course.room || undefined,
    notes: lines.filter(Boolean).join('\n'),
  };
}

/** Filtre les cours à la cible d'export unique (compte + enfant). */
export function filterCoursesForExport(courses: Course[]): Course[] {
  const target = getExportTarget();
  if (!target) return courses;
  const acc = useAccountStore.getState().accounts.find((a: any) => a.id === target.accountId);
  const serviceIds: string[] = (acc?.services ?? []).map((s: any) => s.id);
  return (courses || []).filter(c => {
    if (serviceIds.length > 0 && !serviceIds.includes(c.createdByAccount)) return false;
    const kid = (c as any)?.kidName;
    if (typeof kid === "string" && kid.length > 0 && target.childName && kid !== target.childName) {
      return false;
    }
    return true;
  });
}

/** Purge le futur d'un slot enfant (changement de cible). */
export async function purgeChildFuture(childKey: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const prefs = useSettingsStore.getState().personalization;
    const map = prefs.calendarEventMapByChild?.[childKey] ?? (childKey ? undefined : prefs.calendarEventMap);
    if (!map) return;
    const start = todayStart().getTime();
    for (const [courseId, eventId] of Object.entries(map)) {
      try {
        let eventStart = 0;
        try {
          const details = Calendar?.getEventAsync ? await Calendar.getEventAsync(eventId).catch(() => null) : null;
          eventStart = details ? new Date(details.startDate).getTime() : 0;
        } catch { /* best-effort */ }
        if (eventStart && eventStart < start) continue;
        try { await Calendar.deleteEventAsync(eventId); } catch { /* déjà supprimé */ }
      } catch { /* best-effort */ }
      void courseId;
    }
    const nextByChild = { ...(prefs.calendarEventMapByChild ?? {}) };
    if (nextByChild[childKey]) {
      delete nextByChild[childKey];
      useSettingsStore.getState().mutateProperty('personalization', { calendarEventMapByChild: nextByChild });
    }
  } catch (e) {
    error('purgeChildFuture: ' + String(e));
  }
}

/** Nettoie TOUT le slot enfant (passé + futur) : bouton « Nettoyer tout ». */
export async function purgeChildAll(childKey?: string): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  const prefs = useSettingsStore.getState().personalization;
  const map = childKey
    ? { ...(prefs.calendarEventMapByChild?.[childKey] ?? {}) }
    : { ...(prefs.calendarEventMap ?? {}) };
  let deleted = 0;
  for (const [courseId, eventId] of Object.entries(map)) {
    try {
      await Calendar.deleteEventAsync(eventId);
      deleted += 1;
    } catch {
      // déjà supprimé côté appareil : on nettoie juste le mapping
      deleted += 1;
    }
    void courseId;
  }
  if (childKey) {
    const nextByChild = { ...(prefs.calendarEventMapByChild ?? {}) };
    delete nextByChild[childKey];
    useSettingsStore.getState().mutateProperty('personalization', {
      calendarEventMapByChild: nextByChild,
      calendarEventMap: {},
    });
  } else {
    useSettingsStore.getState().mutateProperty('personalization', { calendarEventMap: {} });
  }
  return deleted;
}

/**
 * Miroir incrémental des cours (fenêtre 7 j) vers le calendrier "Aether".
 * - Upsert les cours futurs (création ou mise à jour via le mapping stocké)
 * - Supprime les événements dont le cours a disparu/été annulé
 * - Ne touche JAMAIS aux événements passés (< aujourd'hui)
 */
export async function syncCoursesToDeviceCalendar(courses: Course[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  const prefs = useSettingsStore.getState().personalization;
  if (!prefs.androidCalendarSyncEnabled) return;
  if (!Calendar?.createEventAsync || !Calendar?.updateEventAsync || !Calendar?.deleteEventAsync) return;
  const granted = await hasCalendarPermissions();
  if (!granted) {
    throw new Error(
      "Permission calendrier refusée : active l'accès au calendrier dans les réglages pour utiliser « Exporter mes cours »."
    );
  }

  const target = getExportTarget();
  const childKey = target ? exportChildKey(target.accountId, target.childName) : undefined;
  let calendarId: string | null;
  try {
    calendarId = await ensureAetherCalendar(childKey, target?.childName);
  } catch (e) {
    error('syncCoursesToDeviceCalendar ensure: ' + String(e));
    throw e;
  }
  if (!calendarId) return;

  const exportable = filterCoursesForExport(courses);

  try {
    const start = todayStart();
    const end = windowEnd();
    // Fenêtre miroir : aujourd'hui 00:00 -> +7 j.
    const inWindow = (exportable || []).filter(c => {
      try {
        const from = new Date(c.from).getTime();
        const to = new Date(c.to ?? c.from).getTime();
        return Number.isFinite(from) && from >= start.getTime() && from <= end.getTime() && Number.isFinite(to);
      } catch {
        return false;
      }
    });

    const prevMap: Record<string, string> = childKey
      ? { ...(prefs.calendarEventMapByChild?.[childKey] ?? {}) }
      : { ...(prefs.calendarEventMap ?? {}) };
    const map: Record<string, string> = { ...prevMap };
    const seenEventIds = new Set<string>();
    // Clé stable par enfant (l.id Pronote peut être réutilisé entre enfants).
    const mapKey = (c: Course) => `${(c as any)?.kidName ?? target?.childName ?? ""}::${String(c.id)}::${new Date(c.from).getTime()}`;
    const wantedCourseIds = new Set(inWindow.map(mapKey));
    let changed = false;

    // Upsert des cours dans la fenêtre via calendarEventMap.
    for (const course of inWindow) {
      const courseId = mapKey(course);
      const details = eventDetails(course);
      const startDate = new Date(course.from);
      const endDate = new Date(course.to ?? course.from);
      const existingId = map[courseId];
      try {
        if (existingId) {
          try {
            await Calendar.updateEventAsync(existingId, {
              title: details.title,
              location: details.location,
              notes: details.notes,
              startDate,
              endDate,
            });
            seenEventIds.add(existingId);
          } catch (e) {
            // Recrée si la màj échoue (événement supprimé côté appareil)
            try {
              const eventId = await Calendar.createEventAsync(calendarId, {
                title: details.title,
                location: details.location,
                notes: details.notes,
                startDate,
                endDate,
              });
              map[courseId] = String(eventId);
              seenEventIds.add(String(eventId));
              changed = true;
            } catch (inner) {
              error('syncCoursesToDeviceCalendar recreate: ' + String(inner));
            }
          }
        } else {
          try {
            const eventId = await Calendar.createEventAsync(calendarId, {
              title: details.title,
              location: details.location,
              notes: details.notes,
              startDate,
              endDate,
            });
            map[courseId] = String(eventId);
            seenEventIds.add(String(eventId));
            changed = true;
          } catch (e) {
            error('syncCoursesToDeviceCalendar create: ' + String(e));
          }
        }
      } catch (e) {
        error('syncCoursesToDeviceCalendar upsert: ' + String(e));
      }
    }

    // Supprime les événements miroir orphelins (cours disparu/annulé ou hors fenêtre),
    // futurs uniquement — le passé (< aujourd'hui) est toujours conservé.
    for (const [courseId, eventId] of Object.entries(map)) {
      if (wantedCourseIds.has(courseId) && seenEventIds.has(eventId)) continue;
      try {
        let eventStart = 0;
        try {
          const details = Calendar?.getEventAsync
            ? await Calendar.getEventAsync(eventId).catch(() => null)
            : null;
          eventStart = details ? new Date(details.startDate).getTime() : 0;
        } catch (e) {
          error('syncCoursesToDeviceCalendar getEvent: ' + String(e));
        }
        if (eventStart && eventStart < start.getTime()) continue; // passé : on garde
        try {
          await Calendar.deleteEventAsync(eventId);
        } catch (e) {
          // déjà supprimé côté appareil : on nettoie juste le mapping
          error('syncCoursesToDeviceCalendar delete: ' + String(e));
        }
      } catch (e) {
        error('syncCoursesToDeviceCalendar orphan: ' + String(e));
      }
      delete map[courseId];
      changed = true;
    }

    const prevLen = Object.keys(prevMap).length;
    if (changed || Object.keys(map).length !== prevLen) {
      if (childKey) {
        useSettingsStore.getState().mutateProperty('personalization', {
          calendarEventMapByChild: { ...(useSettingsStore.getState().personalization.calendarEventMapByChild ?? {}), [childKey]: map },
          calendarEventMap: map,
        });
      } else {
        useSettingsStore.getState().mutateProperty('personalization', { calendarEventMap: map });
      }
    }
  } catch (e) {
    // Propage les erreurs de permission pour affichage UI, log les autres.
    if (e instanceof Error && e.message.includes('Permission calendrier refusée')) {
      throw e;
    }
    error('syncCoursesToDeviceCalendar: ' + String(e));
  }
}
