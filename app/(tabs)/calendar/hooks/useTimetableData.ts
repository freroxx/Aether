import { useCallback, useEffect, useMemo,useRef, useState } from 'react';

import { useTimetable } from '@/database/useTimetable';
import { getManager, subscribeManagerUpdate } from "@/services/shared";
import { useAccountStore } from '@/stores/account';
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
  
  const timetable = useMemo(() => {
    return rawTimetable.map(day => ({
      ...day,
      courses: day.courses.filter(course =>
        services.includes(course.createdByAccount) ||
        course.createdByAccount.startsWith('ical_') ||
        course.createdByAccount === 'android_calendar' ||
        course.createdByAccount.startsWith('calendar_')
      )
    })).filter(day => day.courses.length > 0);
  }, [rawTimetable, servicesKey]);

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
          await Promise.all(
            toFetch.map((c) => {
              return (manager as NonNullable<typeof manager>).getWeeklyTimetable(c.week, c.targetDate)
            })
          );

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
  // Déclenché à chaque refresh EDT (ouverture, focus, horaire) si activé.
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const allCourses = timetable.flatMap(d => d.courses ?? []);
      if (allCourses.length === 0) return;
      import("@/services/local/android-calendar-sync")
        .then(m => m.syncCoursesToDeviceCalendar(allCourses))
        .catch(() => {});
    }, 2000);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [timetable]);

  return {
    timetable,
    refresh,
    manualRefreshing,
    handleRefresh,
    isLoading
  };
}
