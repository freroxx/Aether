import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import type { Course } from '@/services/shared/timetable';
import { useSettingsStore } from '@/stores/settings';
import { error, log } from '@/utils/logger/logger';
import { hasCalendarPermissions } from './android-calendar';

export const AETHER_CALENDAR_TITLE = 'Aether';
/** Fenêtre miroir : aujourd'hui -> +7 jours (ex: activé le 8 sept. -> jusqu'au 15). */
export const SYNC_WINDOW_DAYS = 7;

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

/** Retourne l'id du calendrier dédié, le crée si besoin. */
export async function ensureAetherCalendar(): Promise<string | null> {
  try {
    if (Platform.OS !== 'android') return null;
    if (!Calendar?.getCalendarsAsync || !Calendar?.createCalendarAsync) return null;
    const granted = await hasCalendarPermissions();
    if (!granted) return null;

    const stored = useSettingsStore.getState().personalization.aetherCalendarId;
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (stored) {
      const found = (calendars || []).find(c => String(c.id) === stored);
      if (found) return stored;
    }
    const existing = (calendars || []).find(c => c.title === AETHER_CALENDAR_TITLE);
    if (existing) {
      const id = String(existing.id);
      useSettingsStore.getState().mutateProperty('personalization', { aetherCalendarId: id });
      return id;
    }
    // Crée le calendrier sur la première source locale/disponible
    const first = (calendars || [])[0];
    const source = first?.source;
    const id = await Calendar.createCalendarAsync({
      title: AETHER_CALENDAR_TITLE,
      color: '#29947A',
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: source?.id,
      source,
      name: AETHER_CALENDAR_TITLE,
      ownerAccount: 'Aether',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    const idStr = String(id);
    useSettingsStore.getState().mutateProperty('personalization', { aetherCalendarId: idStr });
    log('Aether device calendar created: ' + idStr);
    return idStr;
  } catch (e) {
    error('ensureAetherCalendar: ' + String(e));
    return null;
  }
}

function eventDetails(course: Course): { title: string; location?: string; notes?: string } {
  const parts = [course.teacher, course.room].filter(Boolean);
  return {
    title: course.subject || 'Cours',
    location: course.room || undefined,
    notes: [`Aether · ${course.subject || 'Cours'}`, course.teacher ?? '', course.room ?? '']
      .filter(Boolean)
      .join('\n'),
  };
}

/**
 * Miroir incrémental des cours (fenêtre 7 j) vers le calendrier "Aether".
 * - Upsert les cours futurs (création ou mise à jour via le mapping stocké)
 * - Supprime les événements dont le cours a disparu/été annulé
 * - Ne touche JAMAIS aux événements passés (< aujourd'hui)
 */
export async function syncCoursesToDeviceCalendar(courses: Course[]): Promise<void> {
  try {
    if (Platform.OS !== 'android') return;
    const prefs = useSettingsStore.getState().personalization;
    if (!prefs.androidCalendarSyncEnabled) return;
    if (!Calendar?.createEventAsync || !Calendar?.updateEventAsync || !Calendar?.deleteEventAsync) return;
    const granted = await hasCalendarPermissions();
    if (!granted) return;

    const calendarId = await ensureAetherCalendar();
    if (!calendarId) return;

    const start = todayStart();
    const end = windowEnd();
    const inWindow = (courses || []).filter(c => {
      try {
        const from = new Date(c.from).getTime();
        const to = new Date(c.to ?? c.from).getTime();
        return Number.isFinite(from) && from >= start.getTime() && from <= end.getTime() && Number.isFinite(to);
      } catch {
        return false;
      }
    });

    const map: Record<string, string> = { ...(prefs.calendarEventMap ?? {}) };
    const seenEventIds = new Set<string>();
    const wantedCourseIds = new Set(inWindow.map(c => String(c.id)));
    let changed = false;

    for (const course of inWindow) {
      const courseId = String(course.id);
      const details = eventDetails(course);
      const startDate = new Date(course.from);
      const endDate = new Date(course.to ?? course.from);
      const existingId = map[courseId];
      try {
        if (existingId) {
          await Calendar.updateEventAsync(existingId, {
            title: details.title,
            location: details.location,
            notes: details.notes,
            startDate,
            endDate,
          });
          seenEventIds.add(existingId);
        } else {
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
        }
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
        } catch {
          error('syncCoursesToDeviceCalendar upsert: ' + String(e));
        }
      }
    }

    // Supprime les événements miroir orphelins (cours disparu/annulé ou hors fenêtre),
    // sauf s'ils sont déjà passés (passé conservé).
    const now = Date.now();
    for (const [courseId, eventId] of Object.entries(map)) {
      if (wantedCourseIds.has(courseId) && seenEventIds.has(eventId)) continue;
      try {
        const details = Calendar?.getEventAsync
          ? await Calendar.getEventAsync(eventId).catch(() => null)
          : null;
        const eventStart = details ? new Date(details.startDate).getTime() : 0;
        if (eventStart && eventStart < start.getTime()) continue; // passé : on garde
        void now;
        await Calendar.deleteEventAsync(eventId);
      } catch {
        // déjà supprimé côté appareil : on nettoie juste le mapping
      }
      delete map[courseId];
      changed = true;
    }

    if (changed || Object.keys(map).length !== Object.keys(prefs.calendarEventMap ?? {}).length) {
      useSettingsStore.getState().mutateProperty('personalization', { calendarEventMap: map });
    }
  } catch (e) {
    error('syncCoursesToDeviceCalendar: ' + String(e));
  }
}
