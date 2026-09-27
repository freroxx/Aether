import { useCallback, useEffect, useRef, useState } from "react";

import {
  getHomeworksFromCache,
  getHomeworkRouteId,
  getWeekNumberFromDate,
} from "@/database/useHomework";
import { getCoursesFromCache } from "@/database/useTimetable";
import { getManager } from "@/services/shared";
import { getSimpleCache, setSimpleCache } from "@/services/shared/simple-cache";
import type {
  Course,
  CourseResource,
  WeekLessonContent,
} from "@/services/shared/timetable";
import {
  matchContentForCourse,
  normSubject,
} from "@/services/pronote/timetable";
import { formatHTML } from "@/utils/format/html";
import {
  getWeekRangeForWeekNumber,
  inferYearForWeek,
} from "@/utils/services/periods";
import { getSubjectColor } from "@/utils/subjects/colors";
import { getSubjectEmoji } from "@/utils/subjects/emoji";
import { getSubjectName } from "@/utils/subjects/name";

export type ViewMode = "chrono" | "weekly";

export interface BuiltAttachment {
  name?: string;
  url?: string;
  createdByAccount: string;
}

export interface BuiltContent {
  title?: string;
  body: string;
  theme: string;
  attachments: BuiltAttachment[];
}

export interface SessionItem {
  key: string;
  subjectKey: string;
  pretty: string;
  color: string;
  emoji: string;
  teacher: string;
  room: string;
  slot: string;
  /** Ligne “10h15 – 12h15 · Salle · Prof” pré-assemblée (sans séparateur fantôme). */
  meta: string;
  from: Date;
  contents: BuiltContent[];
  fileCount: number;
  homeworkRouteId?: string;
  /** Chaîne normalisée (sans accents, minuscules) pour la recherche plein texte. */
  searchHay: string;
}

export interface DaySection {
  key: string;
  dateLabel: string;
  lessons: SessionItem[];
}

export interface SubjectInfo {
  key: string;
  pretty: string;
  color: string;
  count: number;
}

const normHay = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toDateSafe = (v: unknown): Date | null => {
  try {
    const d = v instanceof Date ? v : new Date(v as never);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const themeLabel = (category: unknown): string => {
  if (category === null || category === undefined) return "";
  const s = String(category).trim();
  if (s.length === 0 || s === "0") return "";
  return s;
};

const fmtDay = (d: Date) => {
  try {
    const s = d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return "";
  }
};

const fmtTime = (d: Date) => {
  try {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "numeric",
    });
  } catch {
    return "";
  }
};

type HomeworkLike = {
  subject?: unknown;
  dueDate?: unknown;
};

function buildSections(
  flatCourses: Course[],
  hwList: HomeworkLike[],
  contentList: WeekLessonContent[],
  days: Date[]
): {
  built: DaySection[];
  subjectList: SubjectInfo[];
  themeList: string[];
  count: number;
} {
  const subjectCounts = new Map<
    string,
    { pretty: string; color: string; count: number }
  >();
  const themeSet = new Set<string>();

  const built: DaySection[] = [];
  for (const date of days) {
    const dayKey = localDayKey(date);
    const dayCourses = flatCourses.filter((c) => {
      const f = toDateSafe((c as { from?: unknown }).from);
      return f ? localDayKey(f) === dayKey : false;
    });

    const lessons: SessionItem[] = [];
    for (let idx = 0; idx < dayCourses.length; idx++) {
      const course = dayCourses[idx];
      let extra: CourseResource[] = [];
      try {
        extra = matchContentForCourse(contentList, course) ?? [];
      } catch {
        extra = [];
      }
      const fromCache = Array.isArray(course.content) ? course.content : [];
      const seen = new Set(
        fromCache.map((c) => `${c.title ?? ""}‖${c.description ?? ""}`)
      );
      const merged = [...fromCache];
      for (const c of extra) {
        const k = `${c.title ?? ""}‖${c.description ?? ""}`;
        if (!seen.has(k)) {
          seen.add(k);
          merged.push(c);
        }
      }
      // Fini le bruit : on ne garde QUE les séances avec du contenu réel.
      if (merged.length === 0) continue;

      const rawSubject = course.subject ?? "";
      const pretty = getSubjectName(rawSubject);
      const color = getSubjectColor(rawSubject);
      const emoji = getSubjectEmoji(rawSubject);
      const subjectKey = normSubject(rawSubject) || pretty.toLowerCase();
      const prev = subjectCounts.get(subjectKey);
      if (prev) prev.count += 1;
      else subjectCounts.set(subjectKey, { pretty, color, count: 1 });

      const fromD = toDateSafe((course as { from?: unknown }).from) ?? date;
      const toD =
        toDateSafe((course as { to?: unknown }).to) ?? fromD;
      const teacherNames = Array.isArray(
        (course as { teacherNames?: unknown }).teacherNames
      )
        ? ((course as { teacherNames: string[] }).teacherNames.join(", "))
        : "";
      const teacher =
        course.teacher || teacherNames || "";
      const room = course.room || "";
      const slot = [fmtTime(fromD), fmtTime(toD)]
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .join(" – ");
      const metaLine = [slot, room, teacher]
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .join(" · ");

      const contents: BuiltContent[] = merged.map((c) => {
        const body = String(
          formatHTML(String(c.description ?? ""))
        ).trim();
        const theme = themeLabel(c.category);
        if (theme) themeSet.add(theme);
        return {
          title: c.title ?? undefined,
          body,
          theme,
          attachments: (c.attachments ?? []).map((a) => ({
            name: (a as { name?: string }).name,
            url: (a as { url?: string }).url,
            createdByAccount: (a as { createdByAccount?: string })
              .createdByAccount as string,
          })),
        };
      });
      const fileCount = contents.reduce(
        (n, c) => n + c.attachments.length,
        0
      );

      // Devoir lié : même matière + rendu proche après la séance.
      let homeworkRouteId: string | undefined;
      try {
        const want = normSubject(rawSubject);
        let best: { routeId: string; dist: number } | null = null;
        for (const h of hwList ?? []) {
          const got = normSubject(h.subject);
          if (want && got && want !== got) {
            if (!got.includes(want) && !want.includes(got)) continue;
          }
          const due = toDateSafe(h.dueDate);
          if (!due) continue;
          const dist = due.getTime() - fromD.getTime();
          if (dist < -2 * 86400000 || dist > 14 * 86400000) continue;
          let routeId = "";
          try {
            routeId = getHomeworkRouteId(h as never);
          } catch {
            continue;
          }
          if (!routeId) continue;
          if (!best || Math.abs(dist) < Math.abs(best.dist)) {
            best = { routeId, dist };
          }
        }
        if (best) homeworkRouteId = best.routeId;
      } catch {
        /* best-effort */
      }

      const searchHay = normHay(
        [
          rawSubject,
          pretty,
          teacher,
          room,
          ...contents.flatMap((c) => [c.title ?? "", c.body]),
        ].join(" ")
      );

      lessons.push({
        key: `${dayKey}-${idx}`,
        subjectKey,
        pretty,
        color,
        emoji,
        teacher,
        room,
        slot,
        meta: metaLine,
        from: fromD,
        contents,
        fileCount,
        homeworkRouteId,
        searchHay,
      });
    }

    lessons.sort((a, b) => a.from.getTime() - b.from.getTime());
    if (lessons.length === 0) continue;
    built.push({ key: dayKey, dateLabel: fmtDay(date), lessons });
  }

  const subjectList: SubjectInfo[] = [...subjectCounts.entries()]
    .map(([key, v]) => ({ key, pretty: v.pretty, color: v.color, count: v.count }))
    .sort((a, b) => b.count - a.count || a.pretty.localeCompare(b.pretty));
  const themeList = [...themeSet].sort((a, b) => a.localeCompare(b));

  let count = 0;
  for (const s of built) {
    for (const l of s.lessons) {
      count += l.contents.length + l.fileCount;
    }
  }
  return { built, subjectList, themeList, count };
}

/** Données Contenus et ressources : cache-first (peinture instantanée),
 *  refresh réseau en arrière-plan. Les vides sont exclus au build. */
export function useRessourcesData(
  viewMode: ViewMode,
  selectedWeek: number,
  fromDate: Date
) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  /** Données en cache affichées, refresh réseau en échec (bandeau hors-ligne). */
  const [offline, setOffline] = useState(false);
  const [sections, setSections] = useState<DaySection[]>([]);
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [totalResources, setTotalResources] = useState(0);
  const loadId = useRef(0);

  const load = useCallback(
    async (isRefresh: boolean) => {
      const myId = ++loadId.current;
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      setOffline(false);
      try {
        const now = new Date();
        let rangeStart: Date;
        let rangeEnd: Date;
        let weeks: number[];

        if (viewMode === "weekly") {
          const range = getWeekRangeForWeekNumber(selectedWeek, now);
          rangeStart = range.start;
          rangeEnd = range.end;
          weeks = [selectedWeek - 1, selectedWeek, selectedWeek + 1].filter(
            (w) => w >= 1
          );
        } else {
          const start = new Date(fromDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(now);
          end.setHours(23, 59, 59, 999);
          if (
            Math.round((end.getTime() - start.getTime()) / 86400000) > 31
          ) {
            start.setTime(end.getTime() - 31 * 86400000);
          }
          rangeStart = start;
          rangeEnd = end;
          const wset = new Set<number>();
          const cursor = new Date(start);
          let guard = 0;
          while (cursor.getTime() <= end.getTime() && guard < 40) {
            try {
              wset.add(getWeekNumberFromDate(cursor));
            } catch {
              /* ignore */
            }
            cursor.setDate(cursor.getDate() + 7);
            guard += 1;
          }
          weeks = [...wset];
          if (weeks.length === 0) weeks = [getWeekNumberFromDate(now)];
        }

        const year = inferYearForWeek(
          viewMode === "weekly"
            ? selectedWeek
            : getWeekNumberFromDate(rangeStart),
          now
        );
        const cacheKey =
          `ressources:contents:${rangeStart.getFullYear()}-${rangeStart.getMonth()}-${rangeStart.getDate()}:` +
          `${rangeEnd.getFullYear()}-${rangeEnd.getMonth()}-${rangeEnd.getDate()}`;

        const days: Date[] = [];
        {
          const cursor = new Date(rangeStart);
          cursor.setHours(0, 0, 0, 0);
          const endDay = new Date(rangeEnd);
          endDay.setHours(0, 0, 0, 0);
          let guard = 0;
          while (cursor.getTime() <= endDay.getTime() && guard < 32) {
            days.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
            guard += 1;
          }
        }

        const fetchCaches = () =>
          Promise.all([
            Promise.all(
              weeks.map((w) => getCoursesFromCache([w], year).catch(() => []))
            )
              .then((arr) => arr.flat())
              .catch(() => []),
            Promise.all(
              weeks.map((w) => getHomeworksFromCache(w).catch(() => []))
            )
              .then((arr) => arr.flat())
              .catch(() => []),
          ]);

        const apply = (
          flatCourses: Course[],
          hwList: HomeworkLike[],
          contentList: WeekLessonContent[]
        ) => {
          if (loadId.current !== myId) return;
          const r = buildSections(flatCourses, hwList, contentList, days);
          setSections(
            viewMode === "chrono" ? [...r.built].reverse() : r.built
          );
          setSubjects(r.subjectList);
          setThemes(r.themeList);
          setTotalResources(r.count);
          setLoadError(false);
        };

        // 1) Peinture instantanée : Watermelon + MMKV.
        const [cachedDays, cachedHw] = await fetchCaches();
        if (loadId.current !== myId) return;
        const cachedContents =
          (await getSimpleCache<WeekLessonContent[]>(cacheKey).catch(
            () => null
          )) ?? [];
        apply(
          (cachedDays ?? []).flatMap((d) => d.courses ?? []),
          (cachedHw ?? []) as HomeworkLike[],
          cachedContents
        );
        if (loadId.current !== myId) return;
        setLoading(false);

        // 2) Réseau best-effort en arrière-plan.
        try {
          const manager = getManager();
          if (manager) {
            const freshContents =
              (await manager
                .getWeekContents(rangeStart, rangeEnd)
                .catch(() => [])) ?? [];
            const networkOk =
              Array.isArray(freshContents) && freshContents.length > 0;
            if (loadId.current === myId && networkOk) {
              try {
                await setSimpleCache(
                  cacheKey,
                  freshContents,
                  6 * 3600 * 1000
                );
              } catch {
                /* best-effort */
              }
            }
            if (viewMode === "weekly") {
              try {
                await manager.getHomeworks(selectedWeek).catch(() => []);
              } catch {
                /* best-effort */
              }
            }
            const [freshDays, freshHw] = await fetchCaches();
            if (loadId.current !== myId) return;
            apply(
              (freshDays ?? []).flatMap((d) => d.courses ?? []),
              (((freshHw ?? []).length > 0 ? freshHw : cachedHw) ??
                []) as HomeworkLike[],
              networkOk ? freshContents : cachedContents
            );
            if (loadId.current === myId) {
              // Réseau vide + cache existant = hors-ligne probable.
              const hadCache =
                (cachedDays ?? []).some(
                  (d) => (d.courses ?? []).length > 0
                ) || cachedContents.length > 0;
              setOffline(!networkOk && hadCache);
            }
          } else if (loadId.current === myId) {
            setOffline(true);
          }
        } catch {
          /* offline : on garde le cache */
          if (loadId.current === myId) setOffline(true);
        }
      } catch {
        if (loadId.current !== myId) return;
        setSections([]);
        setSubjects([]);
        setThemes([]);
        setTotalResources(0);
        setLoadError(true);
        setOffline(false);
      } finally {
        if (loadId.current !== myId) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [viewMode, selectedWeek, fromDate]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    sections,
    subjects,
    themes,
    totalResources,
    loading,
    refreshing,
    loadError,
    offline,
    refresh,
  };
}
