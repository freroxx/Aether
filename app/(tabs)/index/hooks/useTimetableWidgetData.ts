import React, { useState, useEffect, useMemo } from "react";
import { createMMKV } from "react-native-mmkv";
import { useAccountStore } from "@/stores/account";
import { useSyncStore } from "@/stores/sync";
import { useTimetable } from "@/database/useTimetable";
import { Course as SharedCourse, CourseStatus } from "@/services/shared/timetable";

const widgetCacheStorage = createMMKV({ id: "home-widget-cache" });

type CachedCourse = Omit<SharedCourse, "from" | "to"> & {
  from: number;
  to: number;
};

type TimetableWidgetCache = {
  fetchedAt: number;
  courses: CachedCourse[];
};

const toTime = (value: unknown): number => {
  try {
    const t = value instanceof Date ? value.getTime() : new Date(value as any).getTime();
    return Number.isFinite(t) ? t : NaN;
  } catch {
    return NaN;
  }
};
const serializeCourse = (course: SharedCourse): CachedCourse | null => {
  try {
    const from = toTime(course?.from);
    const to = toTime(course?.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    return { ...course, from, to };
  } catch {
    return null;
  }
};

const deserializeCourse = (course: CachedCourse): SharedCourse => ({
  ...course,
  from: new Date(course.from),
  to: new Date(course.to)
});

export const useTimetableWidgetData = (options: { showCancelled?: boolean } = {}) => {
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const accounts = useAccountStore((state) => state.accounts);
  const lastUsedAccount = useAccountStore((state) => state.lastUsedAccount);
  const account = accounts.find((a) => a.id === lastUsedAccount);
  const accountEpoch = useSyncStore(s => s.accountEpoch);
  const cacheKey = useMemo(
    () => (account?.id ? `widget:timetable:${account.id}:${account?.selectedChild ?? ""}:${accountEpoch}` : undefined),
    [account?.id, account?.selectedChild, accountEpoch]
  );

  const services = useMemo(() =>
    account?.services?.map((service: { id: string }) => service.id) ?? [],
    [account?.services]
  );

  const [courses, setCourses] = useState<SharedCourse[]>([]);

  const currentYear = now.getFullYear();
  const currentYearWeeks = useMemo(
    () => Array.from({ length: 54 }, (_, index) => index + 1),
    []
  );
  const nextYearWeeks = useMemo(
    () => Array.from({ length: 54 }, (_, index) => index + 1),
    []
  );
  const nextYearDate = useMemo(() => new Date(currentYear + 1, 0, 1), [currentYear]);

  const currentYearTimetable = useTimetable(undefined, currentYearWeeks, now);
  const nextYearTimetable = useTimetable(undefined, nextYearWeeks, nextYearDate);

  const selectedChild = account?.selectedChild;
  const accountIds = useMemo(() => new Set((accounts ?? []).map(a => a.id)), [accounts]);
  const weeklyTimetable = useMemo(() => {
    const merged = new Map<string, (typeof currentYearTimetable)[number]>();
    for (const day of (Array.isArray(currentYearTimetable) ? currentYearTimetable : []).concat(
      Array.isArray(nextYearTimetable) ? nextYearTimetable : []
    )) {
      if (!day?.date) continue;
      const key = new Date(day.date).toISOString().split("T")[0];
      const prev = merged.get(key);
      if (!prev) {
        merged.set(key, { ...day, courses: [...(day.courses ?? [])] });
      } else {
        const ids = new Set(prev.courses.map(c => `${c.createdByAccount}::${(c as any)?.kidName ?? ""}::${toTime(c.from)}::${toTime(c.to)}::${c.subject}`));
        for (const c of day.courses ?? []) {
          const k = `${c.createdByAccount}::${(c as any)?.kidName ?? ""}::${toTime(c.from)}::${toTime(c.to)}::${c.subject}`;
          if (!ids.has(k)) {
            ids.add(k);
            prev.courses.push(c);
          }
        }
      }
    }
    const all = [...merged.values()];
    // Ne filtre par enfant que si l'enfant sélectionné existe vraiment
    // dans les données (sinon selectedChild stale viderait tout).
    const hasSelectedKid =
      !!selectedChild &&
      all.some(d => (d.courses ?? []).some(c => (c as any)?.kidName === selectedChild));
    return all
      .map(day => ({
        ...day,
        courses: Array.isArray(day?.courses) ? day.courses.filter(course => {
          if (!course) return false;
          const owner = course.createdByAccount ?? "";
          // Tolère les deux schémas historiques : service.id OU account.id.
          const ok =
            services.includes(owner) ||
            accountIds.has(owner) ||
            (typeof owner === "string" && owner.startsWith('ical_')) ||
            owner === 'android_calendar' ||
            (typeof owner === "string" && owner.startsWith('calendar_'));
          if (!ok) return false;
          // Miroir Aether : jamais dans le widget.
          const mark = `${String((course as any)?.subject ?? "")} ${(course as any)?.teacher ?? ""} ${(course as any)?.room ?? ""}`;
          if ((owner === 'android_calendar' || owner.startsWith('calendar_')) && mark.includes("Aether")) {
            return false;
          }
          if (hasSelectedKid) {
            const kid = (course as any)?.kidName;
            if (typeof kid === "string" && kid.length > 0 && kid !== selectedChild) {
              return false;
            }
          }
          return true;
        }) : []
      }))
      .filter(day => day.courses.length > 0);
  }, [currentYearTimetable, nextYearTimetable, services, selectedChild, accountIds]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCourses([]);

    if (!cacheKey) {
      setLoading(false);
      return;
    }

    const cachedRaw = widgetCacheStorage.getString(cacheKey);
    if (!cachedRaw) {
      setCourses([]);
      setLoading(false);
      return;
    }

    try {
      const cached = JSON.parse(cachedRaw) as TimetableWidgetCache;
      const hydrated = cached.courses
        .map(deserializeCourse)
        .filter((course) => course.to.getTime() > Date.now())
        .filter((course) => options.showCancelled || course.status !== CourseStatus.CANCELED)
        .sort((a, b) => a.from.getTime() - b.from.getTime());
      hydratedCountRef.current = hydrated.length;
      setCourses(hydrated);
    } catch {
      widgetCacheStorage.remove(cacheKey);
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  const hydratedCountRef = React.useRef(0);
  useEffect(() => {
    setLoading(true);
    if (weeklyTimetable.length === 0) {
      // La DB n'a pas encore résolu : garde le cache hydraté au lieu
      // d'afficher un emploi du temps vide en flash.
      if (hydratedCountRef.current > 0) {
        setLoading(false);
        return;
      }
      setCourses([]);
      setLoading(false);
      return;
    }

    const nowTimestamp = now.getTime();
    const daysWithFutureCourses = weeklyTimetable
      .map((day) => ({
        date: day.date,
        courses: (Array.isArray(day?.courses) ? day.courses : [])
          .filter((course) => !!course && toTime(course.to) > nowTimestamp)
          .filter((course) => options.showCancelled || course.status !== CourseStatus.CANCELED)
          .sort((a, b) => toTime(a.from) - toTime(b.from))
      }))
      .filter((day) => day.courses.length > 0)
      .sort((a, b) => toTime(a.courses[0]?.from) - toTime(b.courses[0]?.from));

    const nextCourses = daysWithFutureCourses[0]?.courses ?? [];
    setCourses(nextCourses);
    if (cacheKey) {
      try {
        const payload: TimetableWidgetCache = {
          fetchedAt: Date.now(),
          courses: nextCourses
            .map(serializeCourse)
            .filter((c): c is CachedCourse => c !== null),
        };
        widgetCacheStorage.set(cacheKey, JSON.stringify(payload));
      } catch {
        // Cache best-effort : un cours malformé ne doit jamais faire crasher l'accueil.
      }
    }
    setLoading(false);
  }, [weeklyTimetable, now, cacheKey]);

  return { courses, loading };
};
