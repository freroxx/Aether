import { useCallback, useEffect, useMemo,useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useTimetable } from '@/database/useTimetable';
import { getManager, subscribeManagerUpdate } from "@/services/shared";
import { useAccountStore } from '@/stores/account';
import { useSettingsStore } from '@/stores/settings';
import { useAlert } from '@/ui/components/AlertProvider';
import { log, warn } from "@/utils/logger/logger";

export function useTimetableData(weekNumber: number, currentDate: Date = new Date()) {
  const safeDateMs = currentDate?.getTime() ?? Date.now();
  const safeDate = useMemo(() => new Date(safeDateMs), [safeDateMs]);
  const [isLoading, setIsLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [fetchedWeeks, setFetchedWeeks] = useState<string[]>([]);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedWeeksRef = useRef<string[]>([]);
  const fetchIdRef = useRef(0);

  const store = useAccountStore.getState();
  const account = store.accounts.find(a => a.id === store.lastUsedAccount);
  const servicesKey = (account?.services?.map((service: { id: string }) => service.id) ?? []).join(',');
  const services: string[] = useMemo(() => (servicesKey ? servicesKey.split(',') : []), [servicesKey]);
  
  const rawTimetable = useTimetable(refresh, [weekNumber - 1, weekNumber, weekNumber + 1], safeDate);
  
  const selectedChild = account?.selectedChild;
  const timetable = useMemo(() => {
    const seen = new Set<string>();
    return rawTimetable.map(day => ({
      ...day,
      courses: day.courses.filter(course => {
        if (!course) return false;
        const owner = course.createdByAccount ?? "";
        const allowed =
          services.includes(owner) ||
          owner.startsWith('ical_') ||
          owner === 'android_calendar' ||
          owner.startsWith('calendar_');
        if (!allowed) return false;
        // Miroir Aether : jamais affiché (marqueur "Aether ·" posé dans notes).
        // Couvre android_calendar ET calendar_* (même créneau, vrai matière/salle).
        const mirrorMark = `${String((course as any)?.subject ?? "")} ${(course as any)?.teacher ?? ""} ${(course as any)?.room ?? ""}`;
        if ((owner === 'android_calendar' || owner.startsWith('calendar_')) && mirrorMark.includes("Aether")) {
          return false;
        }
        // Parent : ne garder que l'enfant sélectionné.
        const kid = (course as any)?.kidName;
        if (typeof kid === "string" && kid.length > 0 && selectedChild && kid !== selectedChild) {
          return false;
        }
        // Clé SANS owner (+teacher) : EDT + miroir résiduel fusionnent.
        const key = `${kid ?? ""}::${course.from?.getTime?.() ?? course.from}::${course.to?.getTime?.() ?? course.to}::${course.subject}::${course.room}::${course.teacher ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    })).filter(day => day.courses.length > 0);
  }, [rawTimetable, servicesKey, selectedChild]);

  const fetchWeeklyTimetable = useCallback(async (targetWeekNumber: number, forceRefresh = false) => {
    const myId = ++fetchIdRef.current;
    setIsLoading(true);
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    fetchTimeoutRef.current = setTimeout(async () => {
      if (fetchIdRef.current !== myId) return;
      if (forceRefresh) {
        setManualRefreshing(true);
      }
      try {
        let manager: ReturnType<typeof getManager> | null;
        try {
          manager = getManager();
        } catch {
          warn('Manager not initialized, iCal events will still work');
          manager = null;
        }
        if (!manager) {
          warn('Manager is null, skipping timetable fetch');
          return;
        }

        const baseDate = new Date(safeDateMs);
        const candidates = [targetWeekNumber - 1, targetWeekNumber, targetWeekNumber + 1].map(week => {
          const targetDate = new Date(baseDate);
          targetDate.setDate(targetDate.getDate() + (week - targetWeekNumber) * 7);
          const year = targetDate.getFullYear();
          const key = `${year}-${week}`;
          return { week, targetDate, key };
        });

        const toFetch = candidates.filter(c => !fetchedWeeksRef.current.includes(c.key));

        if (toFetch.length > 0) {
          if (fetchIdRef.current !== myId) return;
          // Séquentiel (pas de Promise.all) : évite les writes concurrents
          // qui se ressuscitent mutuellement dans addCourseDayToDatabase.
          for (const c of toFetch) {
            if (fetchIdRef.current !== myId) return;
            await (manager as NonNullable<typeof manager>).getWeeklyTimetable(c.week, c.targetDate);
          }

          if (fetchIdRef.current !== myId) return;
          fetchedWeeksRef.current = [
            ...fetchedWeeksRef.current,
            ...toFetch.map(c => c.key),
          ];
          setFetchedWeeks(fetchedWeeksRef.current);
          setRefresh(prev => prev + 1);
        }
      } catch (error) {
        if (fetchIdRef.current !== myId) return;
        log('Error fetching weekly timetable: ' + error);
      } finally {
        if (fetchIdRef.current !== myId) return;
        setIsLoading(false);
        setManualRefreshing(false);
        fetchTimeoutRef.current = null;
      }
    }, 100);
  }, [safeDateMs]);

  useEffect(() => {
    fetchWeeklyTimetable(weekNumber);
  }, [weekNumber, fetchWeeklyTimetable]);

  useEffect(() => {
    const unsubscribe = subscribeManagerUpdate((updatedManager) => {
      if (updatedManager) {
        fetchWeeklyTimetable(weekNumber);
      }
    });
    return () => unsubscribe();
  }, [weekNumber, fetchWeeklyTimetable]);

  useEffect(() => {
    return () => {
      fetchIdRef.current += 1;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefresh(prev => prev + 1);
    fetchWeeklyTimetable(weekNumber, true);
  }, [weekNumber, fetchWeeklyTimetable]);

  // Miroir auto vers le calendrier appareil "Aether" (7 j, futurs uniquement).
  // Déclenché quand l'EDT change et que l'export est activé.
  const syncEnabled = useSettingsStore(s => s.personalization.androidCalendarSyncEnabled ?? false);
  const { showAlert } = useAlert();
  useEffect(() => {
    if (!syncEnabled) return;
    if (Platform.OS !== 'android') return;
    const allCourses = timetable.flatMap(d => d.courses ?? []);
    if (allCourses.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const m = await import("@/services/local/android-calendar-sync");
        if (cancelled) return;
        await m.syncCoursesToDeviceCalendar(allCourses);
      } catch (e) {
        if (cancelled) return;
        warn('Auto device calendar sync failed: ' + String(e));
        try {
          showAlert({
            title: "Échec de l'export calendrier",
            message: e instanceof Error ? e.message : "Impossible d'écrire tes cours dans le calendrier « Aether ».",
            icon: "Calendar",
          });
        } catch {
          // best-effort
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [timetable, syncEnabled, showAlert]);

  return {
    timetable,
    refresh,
    manualRefreshing,
    handleRefresh,
    isLoading
  };
}
