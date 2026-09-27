import { useTheme } from "expo-router/react-navigation";
import { t } from "i18next";
import { Papicons } from "@getpapillon/papicons";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import Reanimated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getHomeworksFromCache, getHomeworkRouteId, getWeekNumberFromDate } from "@/database/useHomework";
import { getCoursesFromCache } from "@/database/useTimetable";
import { getManager } from "@/services/shared";
import { getSimpleCache, setSimpleCache } from "@/services/shared/simple-cache";
import type { Course, CourseResource, WeekLessonContent } from "@/services/shared/timetable";
import { matchContentForCourse, normSubject } from "@/services/pronote/timetable";
import { openAttachment, resolvePronoteFileAuth } from "@/services/pronote/files";
import { formatHTML } from "@/utils/format/html";
import { getAttachmentIcon } from "@/utils/news/getAttachmentIcon";
import { getWeekRangeForWeekNumber, inferYearForWeek } from "@/utils/services/periods";
import { getSubjectColor } from "@/utils/subjects/colors";
import { getSubjectEmoji } from "@/utils/subjects/emoji";
import { getSubjectName } from "@/utils/subjects/name";
import { useAlert } from "@/ui/components/AlertProvider";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import ChipButton from "@/ui/components/ChipButton";
import Icon from "@/ui/components/Icon";
import Search from "@/ui/components/Search";
import Stack from "@/ui/components/Stack";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import Typography from "@/ui/components/Typography";
import MainTabErrorBoundary from "@/ui/components/MainTabErrorBoundary";
import { AetherAppearIn, AetherAppearOut } from "@/ui/utils/Transition";
import useResizable from "@/ui/utils/Resizable";

type ViewMode = "chrono" | "weekly";

interface LinkedHomework {
  routeId: string;
  subject: string;
}

interface SessionItem {
  key: string;
  course: Course;
  contents: CourseResource[];
  linkedHomework?: LinkedHomework;
}

interface DaySection {
  key: string;
  date: Date;
  lessons: SessionItem[];
}

interface SubjectInfo {
  raw: string;
  pretty: string;
  color: string;
  count: number;
}

const ACCENT = "#29947A";

const fmtDay = (d: Date) => {
  try {
    const s = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return "";
  }
};

const fmtDayShort = (d: Date) => {
  try {
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return "";
  }
};

const fmtTime = (d: Date) => {
  try {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" });
  } catch {
    return "";
  }
};

const fmtSlot = (from: Date, to: Date) => {
  try {
    const f = fmtTime(from);
    const e = fmtTime(to);
    if (!f || !e) return "";
    return `${f} à ${e}`.replace(" à ", " à ");
  } catch {
    return "";
  }
};

const toDateSafe = (v: unknown): Date | null => {
  try {
    const d = v instanceof Date ? v : new Date(v as never);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const localDayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const themeLabel = (category: unknown): string => {
  if (category === null || category === undefined) return "";
  const s = String(category).trim();
  if (s.length === 0 || s === "0") return "";
  return s;
};

function RessourcesView() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const alert = useAlert();
  const { isLarge } = useResizable();

  const defaultWeek = useMemo(() => {
    try {
      return getWeekNumberFromDate(new Date());
    } catch {
      return 1;
    }
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek);
  const [fromDate, setFromDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [chronoDays, setChronoDays] = useState(14);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [showSubjectDrawer, setShowSubjectDrawer] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState<DaySection[]>([]);
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [totalResources, setTotalResources] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);

  const headerHeight = insets.top + (isLarge ? 70 : 118) + (Platform.OS === "android" ? 6 : 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let rangeStart: Date;
      let rangeEnd: Date;
      let weeks: number[];

      if (viewMode === "weekly") {
        const range = getWeekRangeForWeekNumber(selectedWeek, now);
        rangeStart = range.start;
        rangeEnd = range.end;
        const year = inferYearForWeek(selectedWeek, now);
        void year;
        // Semaine + précharge ±1 comme le calendrier (cache déjà chaud).
        weeks = [selectedWeek - 1, selectedWeek, selectedWeek + 1].filter((w) => w >= 1);
      } else {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        // Backend clamp 62j : on borne la fenêtre chrono.
        const maxDays = 31;
        const diffDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
        if (diffDays > maxDays) {
          start.setTime(end.getTime() - maxDays * 86400000);
        }
        rangeStart = start;
        rangeEnd = end;
        const wset = new Set<number>();
        const cursor = new Date(start);
        let guard = 0;
        while (cursor.getTime() <= end.getTime() && guard < 40) {
          try {
            wset.add(getWeekNumberFromDate(cursor));
          } catch { /* ignore */ }
          cursor.setDate(cursor.getDate() + 7);
          guard += 1;
        }
        weeks = [...wset];
        if (weeks.length === 0) weeks = [getWeekNumberFromDate(now)];
      }

      const year = inferYearForWeek(viewMode === "weekly" ? selectedWeek : getWeekNumberFromDate(rangeStart), now);

      // 1) Cache immédiat (Watermelon EDT + devoirs + MMKV contenus) : offline-first.
      const cacheKey = `ressources:contents:${rangeStart.getFullYear()}-${rangeStart.getMonth()}-${rangeStart.getDate()}:${rangeEnd.getFullYear()}-${rangeEnd.getMonth()}-${rangeEnd.getDate()}`;
      const [cachedDays, homeworks] = await Promise.all([
        Promise.all(weeks.map((w) => getCoursesFromCache([w], year).catch(() => [])))
          .then((arr) => arr.flat())
          .catch(() => []),
        Promise.all(weeks.map((w) => getHomeworksFromCache(w).catch(() => [])))
          .then((arr) => arr.flat())
          .catch(() => []),
      ]);
      let contents: WeekLessonContent[] = (await getSimpleCache<WeekLessonContent[]>(cacheKey).catch(() => null)) ?? [];

      const buildSections = (
        flatCourses: Course[],
        hwList: typeof homeworks,
        contentList: WeekLessonContent[]
      ): { built: DaySection[]; subjectList: SubjectInfo[]; themeList: string[]; count: number } => {
        // Jours de la fenêtre.
        const days: Date[] = [];
        if (viewMode === "weekly") {
          const r = getWeekRangeForWeekNumber(selectedWeek, now);
          for (let i = 0; i < 7; i++) {
            const d = new Date(r.start);
            d.setDate(r.start.getDate() + i);
            days.push(d);
          }
        } else {
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

        const subjectCounts = new Map<string, { pretty: string; color: string; count: number }>();
        const themeSet = new Set<string>();
        const bumpSubject = (raw: string) => {
          const pretty = getSubjectName(raw ?? "");
          const key = normSubject(raw) || pretty.toLowerCase();
          const prev = subjectCounts.get(key);
          if (prev) prev.count += 1;
          else subjectCounts.set(key, { pretty, color: getSubjectColor(raw ?? ""), count: 1 });
        };

        const built: DaySection[] = days.map((date) => {
          const dayKey = localDayKey(date);
          const dayCourses = flatCourses.filter((c) => {
            const f = toDateSafe((c as { from?: unknown }).from);
            return f ? localDayKey(f) === dayKey : false;
          });

          const lessons: SessionItem[] = dayCourses.map((course, idx) => {
            let extra: CourseResource[] = [];
            try {
              extra = matchContentForCourse(contentList, course) ?? [];
            } catch {
              extra = [];
            }
            const fromCache = Array.isArray(course.content) ? course.content : [];
            // Déduplique cache vs batch (même titre+description).
            const seen = new Set(fromCache.map((c) => `${c.title ?? ""}‖${c.description ?? ""}`));
            const merged = [...fromCache];
            for (const c of extra) {
              const k = `${c.title ?? ""}‖${c.description ?? ""}`;
              if (!seen.has(k)) {
                seen.add(k);
                merged.push(c);
              }
            }
            for (const c of merged) {
              const lbl = themeLabel(c.category);
              if (lbl) themeSet.add(lbl);
              bumpSubject(course.subject ?? "");
            }
            if (merged.length === 0) bumpSubject(course.subject ?? "");

            // Lien devoir : même matière (insensible accents) + rendu proche après la séance.
            let linkedHomework: LinkedHomework | undefined;
            try {
              const fromD = toDateSafe((course as { from?: unknown }).from);
              const want = normSubject(course.subject ?? "");
              let best: { routeId: string; subject: string; dist: number } | null = null;
              for (const h of hwList ?? []) {
                const hwSubject = (h as { subject?: unknown }).subject;
                const got = normSubject(hwSubject);
                if (want && got && want !== got) {
                  // Tolère abréviations via includes.
                  if (!got.includes(want) && !want.includes(got)) continue;
                }
                const due = toDateSafe((h as { dueDate?: unknown }).dueDate);
                if (!fromD || !due) continue;
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
                  best = { routeId, subject: String(hwSubject ?? ""), dist };
                }
              }
              if (best) linkedHomework = { routeId: best.routeId, subject: best.subject };
            } catch { /* best-effort */ }

            const f = toDateSafe((course as { from?: unknown }).from);
            return {
              key: `${dayKey}-${idx}-${String(course.id ?? idx)}`,
              course,
              contents: merged,
              linkedHomework,
            };
          });

          lessons.sort((a, b) => {
            const fa = toDateSafe((a.course as { from?: unknown }).from)?.getTime() ?? 0;
            const fb = toDateSafe((b.course as { from?: unknown }).from)?.getTime() ?? 0;
            return fa - fb;
          });

          return { key: dayKey, date, lessons };
        });

        const subjectList: SubjectInfo[] = [...subjectCounts.entries()]
          .map(([key, v]) => ({ raw: key, pretty: v.pretty, color: v.color, count: v.count }))
          .sort((a, b) => b.count - a.count || a.pretty.localeCompare(b.pretty));
        const themeList = [...themeSet].sort((a, b) => a.localeCompare(b));

        let count = 0;
        for (const s of built) {
          for (const l of s.lessons) {
            count += l.contents.length;
            for (const c of l.contents) count += c.attachments?.length ?? 0;
          }
        }
        return { built, subjectList, themeList, count };
      };

      // Premier rendu cache (instantané offline).
      const first = buildSections(
        (cachedDays ?? []).flatMap((d) => d.courses ?? []),
        homeworks ?? [],
        contents
      );
      setSections(viewMode === "chrono" ? [...first.built].reverse() : first.built);
      setSubjects(first.subjectList);
      setThemes(first.themeList);
      setTotalResources(first.count);
      setLoading(false);

      // 2) Réseau best-effort : contenus batchés (1 req/semaine) + devoirs frais.
      try {
        const manager = getManager();
        if (manager) {
          const freshContents = (await manager.getWeekContents(rangeStart, rangeEnd).catch(() => [])) ?? [];
          if (Array.isArray(freshContents) && freshContents.length > 0) {
            contents = freshContents;
            try {
              await setSimpleCache(cacheKey, freshContents, 6 * 3600 * 1000);
            } catch { /* best-effort */ }
          }
          if (viewMode === "weekly") {
            try {
              await manager.getHomeworks(selectedWeek).catch(() => []);
            } catch { /* best-effort */ }
          }
          const [freshDays, freshHw] = await Promise.all([
            Promise.all(weeks.map((w) => getCoursesFromCache([w], year).catch(() => [])))
              .then((arr) => arr.flat())
              .catch(() => []),
            Promise.all(weeks.map((w) => getHomeworksFromCache(w).catch(() => [])))
              .then((arr) => arr.flat())
              .catch(() => []),
          ]);
          const second = buildSections(
            (freshDays ?? []).flatMap((d) => d.courses ?? []),
            (freshHw ?? []).length > 0 ? freshHw : homeworks ?? [],
            contents
          );
          setSections(viewMode === "chrono" ? [...second.built].reverse() : second.built);
          setSubjects(second.subjectList);
          setThemes(second.themeList);
          setTotalResources(second.count);
        }
      } catch { /* offline : on garde le cache */ }
    } catch {
      setSections([]);
      setSubjects([]);
      setThemes([]);
      setTotalResources(0);
      setLoading(false);
    }
  }, [viewMode, selectedWeek, fromDate, chronoDays]);

  useEffect(() => {
    void load();
  }, [load]);

  // Période courante -> depuis = début de trimestre (borné 31j pour le backend 62j).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const manager = getManager();
        if (!manager?.getCurrentPeriod) return;
        const period = await manager.getCurrentPeriod().catch(() => null);
        const start = (period as unknown as { start?: unknown })?.start;
        const d = toDateSafe(start);
        if (!d || cancelled) return;
        const now = new Date();
        const diffDays = Math.round((now.getTime() - d.getTime()) / 86400000);
        if (diffDays > 0 && diffDays <= 62) {
          const nd = new Date(d);
          nd.setHours(0, 0, 0, 0);
          setFromDate(nd);
          setChronoDays(Math.min(31, diffDays + 1));
        }
      } catch { /* best-effort */ }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openFile = useCallback(
    (attachment: { name?: string; url?: string; createdByAccount: string }, dueDate?: Date) => {
      const key = `${attachment.name ?? ""}-${attachment.url ?? ""}`;
      if (downloading) return;
      setDownloading(key);
      void openAttachment(
        attachment as never,
        resolvePronoteFileAuth(attachment.createdByAccount),
        alert,
        dueDate
      ).finally(() => setDownloading(null));
    },
    [alert, downloading]
  );

  const openHomework = useCallback((routeId: string) => {
    try {
      router.push({ pathname: "/(tabs)/tasks/[id]", params: { id: routeId } });
    } catch {
      try {
        router.push("/(tabs)/tasks" as never);
      } catch { /* ignore */ }
    }
  }, []);

  const filteredSections = useMemo(() => {
    const q = searchTerm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return sections
      .map((section) => {
        const lessons = section.lessons.filter((lesson) => {
          const c = lesson.course;
          // Filtre matière.
          if (selectedSubject !== "all") {
            const got = normSubject(c.subject ?? "");
            if (got !== selectedSubject) return false;
          }
          // Filtre thème.
          if (selectedTheme !== "all") {
            const hasTheme = lesson.contents.some((r) => themeLabel(r.category) === selectedTheme);
            if (!hasTheme) return false;
          }
          // Recherche plein texte (matière + titre + description + prof).
          if (q.length > 0) {
            const hay = [
              c.subject ?? "",
              getSubjectName(c.subject ?? ""),
              c.teacher ?? "",
              ...lesson.contents.flatMap((r) => [r.title ?? "", String(formatHTML(String(r.description ?? "")))]),
            ]
              .join(" ")
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        return { ...section, lessons };
      })
      .filter((s) => s.lessons.length > 0);
  }, [sections, searchTerm, selectedSubject, selectedTheme]);

  const weekLabel = useMemo(() => {
    try {
      return String(selectedWeek);
    } catch {
      return "";
    }
  }, [selectedWeek]);

  const depuisLabel = useMemo(() => fmtDayShort(fromDate), [fromDate]);

  const themeActions = useMemo(
    () => [
      {
        title: t("Ressources_Theme_Title", "Thème"),
        subactions: [{ title: t("Ressources_AllThemes", "Tous les thèmes"), id: "theme:all", state: (selectedTheme === "all" ? "on" : "off") as "on" | "off" },
          ...themes.map((th) => ({
            title: th,
            id: `theme:${th}`,
            state: (selectedTheme === th ? "on" : "off") as "on" | "off",
          })),
        ],
        displayInline: true,
      },
    ],
    [themes, selectedTheme]
  );

  const selectedSubjectPretty = useMemo(() => {
    if (selectedSubject === "all") return t("Ressources_AllSubjects", "Toutes les matières");
    const found = subjects.find((s) => s.raw === selectedSubject);
    return found?.pretty ?? t("Ressources_AllSubjects", "Toutes les matières");
  }, [selectedSubject, subjects]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader
        title={
          <TabHeaderTitle
            leading={t("Ressources_Title", "Contenus")}
            subtitle={
              viewMode === "weekly" && selectedWeek === defaultWeek
                ? t("Tasks_ThisWeek", "Cette semaine")
                : viewMode === "chrono"
                  ? t("Ressources_Since", "Depuis le {{date}}", { date: depuisLabel })
                  : undefined
            }
            number={viewMode === "weekly" ? weekLabel : String(totalResources)}
            color={ACCENT}
            height={56}
          />
        }
        trailing={
          <Stack direction="horizontal" gap={8}>
            <Pressable
              onPress={() => setViewMode("chrono")}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 300,
                backgroundColor: viewMode === "chrono" ? ACCENT : colors.card,
              }}
              accessibilityLabel={t("Ressources_View_Chrono", "Vue chronologique")}
            >
              <Typography color={viewMode === "chrono" ? "#FFFFFF" : undefined}>
                {t("Ressources_View_Chrono_Short", "Chrono")}
              </Typography>
            </Pressable>
            <Pressable
              onPress={() => setViewMode("weekly")}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 300,
                backgroundColor: viewMode === "weekly" ? ACCENT : colors.card,
              }}
              accessibilityLabel={t("Ressources_View_Weekly", "Vue hebdomadaire")}
            >
              <Typography color={viewMode === "weekly" ? "#FFFFFF" : undefined}>
                {t("Ressources_View_Weekly_Short", "Semaine")}
              </Typography>
            </Pressable>
          </Stack>
        }
        bottom={
          <Search
            placeholder={t("Ressources_Search_Placeholder", "Rechercher un cours, un chapitre…")}
            color={ACCENT}
            onTextChange={setSearchTerm}
            style={{ marginTop: 6 }}
          />
        }
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: headerHeight }}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingTop: headerHeight + 8,
            paddingBottom: insets.bottom + 32,
            gap: 12,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={headerHeight} />}
        >
          {/* Barre de filtres : navigation dates + matière + thème */}
          <Reanimated.View layout={LinearTransition} entering={AetherAppearIn} exiting={AetherAppearOut}>
            <Stack direction="horizontal" gap={8} vAlign="center">
              {viewMode === "weekly" ? (
                <>
                  <Pressable
                    onPress={() => setSelectedWeek((w) => Math.max(1, w - 1))}
                    style={{ padding: 10, borderRadius: 12, backgroundColor: colors.card }}
                    accessibilityLabel={t("Ressources_PrevWeek", "Semaine précédente")}
                  >
                    <Papicons name="chevronleft" size={20} color={String(colors.text)} />
                  </Pressable>
                  <Pressable
                    onPress={() => setSelectedWeek(defaultWeek)}
                    style={{ padding: 10, borderRadius: 12, backgroundColor: colors.card }}
                    accessibilityLabel={t("Ressources_ThisWeek", "Cette semaine")}
                  >
                    <Papicons name="calendar" size={20} color={String(colors.text)} />
                  </Pressable>
                  <Pressable
                    onPress={() => setSelectedWeek((w) => w + 1)}
                    style={{ padding: 10, borderRadius: 12, backgroundColor: colors.card }}
                    accessibilityLabel={t("Ressources_NextWeek", "Semaine suivante")}
                  >
                    <Papicons name="chevronright" size={20} color={String(colors.text)} />
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => {
                      const d = new Date(fromDate);
                      d.setDate(d.getDate() - 7);
                      setFromDate(d);
                      setChronoDays((n) => Math.min(31, n + 7));
                    }}
                    style={{ padding: 10, borderRadius: 12, backgroundColor: colors.card }}
                    accessibilityLabel={t("Ressources_Since_Earlier", "Remonter plus tôt")}
                  >
                    <Papicons name="chevronleft" size={20} color={String(colors.text)} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 14);
                      d.setHours(0, 0, 0, 0);
                      setFromDate(d);
                      setChronoDays(14);
                    }}
                    style={{ padding: 10, borderRadius: 12, backgroundColor: colors.card }}
                    accessibilityLabel={t("Ressources_Since_Reset", "Revenir à 14 jours")}
                  >
                    <Papicons name="calendar" size={20} color={String(colors.text)} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const d = new Date(fromDate);
                      d.setDate(d.getDate() + 7);
                      const now = new Date();
                      if (d.getTime() <= now.getTime()) setFromDate(d);
                      setChronoDays((n) => Math.max(7, n - 7));
                    }}
                    style={{ padding: 10, borderRadius: 12, backgroundColor: colors.card }}
                    accessibilityLabel={t("Ressources_Since_Later", "Période plus récente")}
                  >
                    <Papicons name="chevronright" size={20} color={String(colors.text)} />
                  </Pressable>
                </>
              )}
              <View style={{ flex: 1 }} />
              <Typography variant="body1" color="secondary">
                {t("Ressources_Count", "{{count}} ressources", { count: totalResources })}
              </Typography>
            </Stack>
          </Reanimated.View>

          <Reanimated.View layout={LinearTransition} entering={AetherAppearIn} exiting={AetherAppearOut}>
            <Stack direction="horizontal" gap={8} vAlign="center">
              <ChipButton icon="book" chevron onPress={() => setShowSubjectDrawer(true)}>
                {String(selectedSubjectPretty)}
              </ChipButton>
              <ChipButton
                icon="filter"
                chevron
                onPressAction={({ nativeEvent }) => {
                  const id = String(nativeEvent.event ?? "");
                  if (id.startsWith("theme:")) setSelectedTheme(id.replace("theme:", ""));
                }}
                actions={themeActions as never}
              >
                {selectedTheme === "all"
                  ? t("Ressources_AllThemes", "Tous les thèmes")
                  : selectedTheme}
              </ChipButton>
            </Stack>
          </Reanimated.View>

          {filteredSections.length === 0 ? (
            <Stack gap={8} vAlign="center" hAlign="center" padding={32}>
              <Typography variant="h4" align="center">
                {t("Ressources_Empty_Title", "Aucune ressource")}
              </Typography>
              <Typography variant="body1" color="secondary" align="center">
                {searchTerm.trim().length > 0 || selectedSubject !== "all" || selectedTheme !== "all"
                  ? t("Ressources_Empty_Filter", "Essaie d'élargir les filtres ou la période.")
                  : t("Ressources_Empty_Details", "Les contenus de cours et pièces jointes apparaîtront ici.")}
              </Typography>
            </Stack>
          ) : (
            filteredSections.map((section) => (
              <Reanimated.View
                key={section.key}
                layout={LinearTransition}
                entering={AetherAppearIn}
                exiting={AetherAppearOut}
                style={{ gap: 10 }}
              >
                <Typography variant="h4">{fmtDay(section.date)}</Typography>
                {section.lessons.map((lesson) => {
                  const c = lesson.course;
                  const from = toDateSafe((c as { from?: unknown }).from) ?? section.date;
                  const to = toDateSafe((c as { to?: unknown }).to) ?? from;
                  const color = getSubjectColor(c.subject ?? "");
                  const teacher = c.teacher || (Array.isArray(c.teacherNames) && c.teacherNames.length > 0 ? c.teacherNames.join(", ") : "");
                  return (
                    <Reanimated.View
                      key={lesson.key}
                      layout={LinearTransition}
                      entering={AetherAppearIn}
                      exiting={AetherAppearOut}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        padding: 14,
                        gap: 8,
                        overflow: "hidden",
                      }}
                    >
                      {/* Accent strip matière */}
                      <View
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          backgroundColor: color,
                        }}
                      />
                      <Stack direction="horizontal" gap={8} vAlign="center">
                        <Typography variant="title" style={{ flex: 1 }}>
                          {getSubjectEmoji(c.subject ?? "")} {getSubjectName(c.subject ?? "")}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="secondary">
                        {fmtSlot(from, to)}
                        {c.room ? ` · ${c.room}` : ""}
                        {teacher ? ` · ${teacher}` : ""}
                      </Typography>
                      {lesson.contents.length === 0 ? (
                        <Typography variant="body1" color="secondary">
                          {t("Ressources_Lesson_Empty", "Pas de contenu publié pour ce cours.")}
                        </Typography>
                      ) : (
                        lesson.contents.map((content, cIdx) => {
                          const lbl = themeLabel(content.category);
                          const body = String(formatHTML(String(content.description ?? ""))).trim();
                          return (
                            <View key={cIdx} style={{ gap: 4 }}>
                              {lbl ? (
                                <Typography variant="caption" color="secondary">
                                  {lbl}
                                </Typography>
                              ) : null}
                              {content.title ? (
                                <Typography variant="title">{content.title}</Typography>
                              ) : null}
                              {body ? (
                                <Typography variant="body1">{body}</Typography>
                              ) : null}
                              {(content.attachments ?? []).map((a, aIdx) => {
                                const key = `${a.name ?? ""}-${a.url ?? ""}`;
                                return (
                                  <Pressable
                                    key={aIdx}
                                    onPress={() => openFile(a as never, from)}
                                    style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}
                                  >
                                    <Icon>
                                      <Papicons name={getAttachmentIcon(a as never)} />
                                    </Icon>
                                    <Typography variant="body1" numberOfLines={1} style={{ flex: 1 }}>
                                      {a.name || a.url}
                                    </Typography>
                                    {downloading === key && <ActivityIndicator size={18} />}
                                  </Pressable>
                                );
                              })}
                            </View>
                          );
                        })
                      )}
                      {lesson.linkedHomework ? (
                        <Pressable
                          onPress={() => openHomework(lesson.linkedHomework!.routeId)}
                          style={{
                            marginTop: 4,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            backgroundColor: `${ACCENT}1A`,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                          accessibilityLabel={t("Ressources_SeeHomework", "Voir le travail à faire")}
                        >
                          <Papicons name="tasks" size={18} color={ACCENT} />
                          <Typography variant="button" style={{ color: ACCENT, flex: 1 }}>
                            {t("Ressources_SeeHomework", "Voir le travail à faire")}
                          </Typography>
                          <Papicons name="chevronright" size={18} color={ACCENT} />
                        </Pressable>
                      ) : null}
                    </Reanimated.View>
                  );
                })}
              </Reanimated.View>
            ))
          )}
        </ScrollView>
      )}

      {/* Tiroir matières : Toutes + badges, comme la spec */}
      {showSubjectDrawer && (
        <Pressable
          onPress={() => setShowSubjectDrawer(false)}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 1000 }}
        >
          <Reanimated.View
            entering={AetherAppearIn}
            exiting={AetherAppearOut}
            style={{
              position: "absolute",
              left: 16,
              top: insets.top + 60,
              width: 300,
              maxHeight: 420,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <BlurView intensity={60} tint={colors.background === "#000000" || String(colors.background).toLowerCase() === "#000" ? "dark" : "light"} style={{ padding: 8 }}>
              <Pressable
                onPress={() => {
                  setSelectedSubject("all");
                  setShowSubjectDrawer(false);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: selectedSubject === "all" ? `${ACCENT}22` : "transparent",
                }}
              >
                <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: ACCENT }} />
                <Typography variant="title" style={{ flex: 1 }}>
                  {t("Ressources_AllSubjects", "Toutes les matières")}
                </Typography>
                <Typography variant="caption" color="secondary">
                  {sections.reduce((n, s) => n + s.lessons.length, 0)}
                </Typography>
              </Pressable>
              {subjects.map((s) => (
                <Pressable
                  key={s.raw}
                  onPress={() => {
                    setSelectedSubject(s.raw);
                    setShowSubjectDrawer(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: selectedSubject === s.raw ? `${ACCENT}22` : "transparent",
                  }}
                >
                  <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: s.color }} />
                  <Typography variant="title" style={{ flex: 1 }} numberOfLines={1}>
                    {s.pretty}
                  </Typography>
                  <View
                    style={{
                      minWidth: 26,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 300,
                      backgroundColor: `${s.color}22`,
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="caption">{String(s.count)}</Typography>
                  </View>
                </Pressable>
              ))}
            </BlurView>
          </Reanimated.View>
        </Pressable>
      )}
    </View>
  );
}

const RessourcesWithBoundary = () => (
  <MainTabErrorBoundary>
    <RessourcesView />
  </MainTabErrorBoundary>
);

export default RessourcesWithBoundary;
