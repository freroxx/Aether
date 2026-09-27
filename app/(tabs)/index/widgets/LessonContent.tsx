import { Papicons } from "@getpapillon/papicons";
import { Link } from "expo-router";
import { t } from "i18next";
import React, { useEffect, useMemo } from "react";
import { Text, View } from "react-native";

import { getCourseRouteId } from "@/database/useTimetable";
import Icon from "@/ui/components/Icon";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import { getSubjectColor } from "@/utils/subjects/colors";
import { getSubjectEmoji } from "@/utils/subjects/emoji";
import { getSubjectName } from "@/utils/subjects/name";
import { useTimetableWidgetData } from "../hooks/useTimetableWidgetData";
import { LessonContentSkeleton } from "@/app/(features)/ressources/components/Skeleton";

type LessonContentWidgetProps = {
  onEmptyStateChange?: (isEmpty: boolean) => void;
  onTargetChange?: (href: string | { pathname: string; params: Record<string, string> }) => void;
};

/** Prochain cours avec du contenu, trié par date (tous les jours futurs, pas J+1 seul). */
export function findNextCourseWithContent(courses: any[] | undefined) {
  const now = Date.now();
  return (courses ?? [])
    .filter(
      c =>
        c &&
        new Date(c.to ?? c.from).getTime() > now &&
        Array.isArray(c.content) &&
        c.content.length > 0
    )
    .sort(
      (a, b) =>
        new Date(a.from).getTime() - new Date(b.from).getTime()
    )[0];
}

/** Prochain cours futur, avec ou sans contenu (conservé pour compat, non utilisé pour la navigation). */
export function findNextCourse(courses: any[] | undefined) {
  const now = Date.now();
  return (courses ?? [])
    .filter(c => c && new Date(c.to ?? c.from).getTime() > now)
    .sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())[0];
}

/** Dernières séances avec contenu (passées ou futures), les plus récentes d'abord. */
function findRecentCoursesWithContent(
  courses: any[] | undefined,
  prefetched: Record<string, any[]>,
  limit = 2
) {
  const withContent = (courses ?? []).filter((c) => {
    if (!c) return false;
    if (Array.isArray(c.content) && c.content.length > 0) return true;
    try {
      const id = getCourseRouteId(c as any);
      return Array.isArray(prefetched[id]) && prefetched[id].length > 0;
    } catch {
      return false;
    }
  });
  withContent.sort(
    (a, b) => new Date(b.from).getTime() - new Date(a.from).getTime()
  );
  return withContent.slice(0, limit).map((c) => {
    try {
      const id = getCourseRouteId(c as any);
      if (
        (!Array.isArray(c.content) || c.content.length === 0) &&
        Array.isArray(prefetched[id])
      ) {
        return { ...c, content: prefetched[id] };
      }
    } catch {
      /* ignore */
    }
    return c;
  });
}

/** La carte Contenu et ressources mène TOUJOURS au flux complet
 *  `/(features)/ressources` (journal de classe : leçons, fichiers, liens),
 *  jamais à la fiche d'un cours isolé `/(modals)/course/[id]`
 *  (qui affichait un « mon cours » sans contenu = confusion cours/contenu). */
const RESSOURCES_HREF = "/(features)/ressources" as const;

/** Date relative courte : « Hier · 10h15 », « Aujourd'hui · 08h00 ». */
function relDateTime(from: unknown): string {
  try {
    const d = new Date(from as never);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
    const rel =
      diff === 0
        ? t("Ressources_Today", "Aujourd'hui")
        : diff === -1
          ? t("Ressources_Yesterday", "Hier")
          : diff === 1
            ? t("Ressources_Tomorrow", "Demain")
            : d.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${rel} · ${hh}h${mm}`;
  } catch {
    return "";
  }
}

function stripHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Carte hero : une seule idée, de l'air, zéro boîte imbriquée. */
function HeroShell({
  accent,
  emoji,
  title,
  subtitle,
  badge,
  children,
}: {
  accent: string;
  emoji?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
      <Link href={RESSOURCES_HREF} asChild>
        <Link.AppleZoom>
          <Stack gap={12} padding={[16, 16]} radius={18} card>
            <Stack direction="horizontal" vAlign="center" gap={10}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: `${accent}1F`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {emoji ? (
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                ) : (
                  <Icon papicon opacity={0.7}>
                    <Papicons name="Info" />
                  </Icon>
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="title" weight="bold" numberOfLines={1}>
                  {title}
                </Typography>
                {subtitle ? (
                  <Typography variant="body2" color="secondary" numberOfLines={1}>
                    {subtitle}
                  </Typography>
                ) : null}
              </View>
              {badge ? (
                <View
                  style={{
                    backgroundColor: `${accent}1A`,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                  }}
                >
                  <Typography variant="caption" weight="bold">
                    {badge}
                  </Typography>
                </View>
              ) : null}
            </Stack>
            {children}
            <Stack direction="horizontal" vAlign="center" gap={6}>
              <View style={{ flex: 1 }} />
              <Typography variant="caption" weight="bold" color="primary" numberOfLines={1}>
                {t("Home_LessonContent_CTA_Ressources", "Tout voir")}
              </Typography>
              <Icon papicon opacity={0.5} size={16}>
                <Papicons name="ArrowRightUp" />
              </Icon>
            </Stack>
          </Stack>
        </Link.AppleZoom>
      </Link>
    </View>
  );
}

const LessonContentWidget = React.memo(({ onEmptyStateChange, onTargetChange }: LessonContentWidgetProps) => {
  const { courses } = useTimetableWidgetData();
  const [prefetched, setPrefetched] = React.useState<Record<string, any[]>>({});
  // Chargé = le batch contenus est revenu (même vide) : skeleton vs vide honnête.
  const [settled, setSettled] = React.useState(false);

  // Pré-charge les contenus en UNE requête batchée (GET /timetable/contents :
  // 1 PageCahierDeTexte / semaine) au lieu de N POST /timetable/lesson-content
  // (1 login + scan chacun -> lent, timeouts, carte toujours vide).
  useEffect(() => {
    let cancelled = false;
    const upcoming = ((courses as any[]) ?? [])
      .filter(c => c && new Date(c.to ?? c.from).getTime() > Date.now())
      .sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())
      .slice(0, 10)
      .filter(c => !Array.isArray(c.content) || c.content.length === 0);
    if (upcoming.length === 0) {
      setSettled(true);
      return;
    }
    (async () => {
      try {
        const { getManager } = await import("@/services/shared");
        const { matchContentForCourse } = await import("@/services/pronote/timetable");
        const { getCourseRouteId: routeIdOf, saveCourseContentRaw } = await import("@/database/useTimetable");
        const manager = getManager();
        if (!manager || cancelled) {
          if (!cancelled) setSettled(true);
          return;
        }
        const first = new Date(upcoming[0].from);
        const last = new Date(upcoming[upcoming.length - 1].from);
        const from = new Date(first.getTime() - 86400000);
        const to = new Date(last.getTime() + 86400000);
        // Fenêtre bornée (backend max 62 j).
        const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000);
        if (spanDays > 60) to.setTime(from.getTime() + 60 * 86400000);
        const batch = await (manager as any).getWeekContents(from, to);
        if (cancelled) return;
        if (!Array.isArray(batch) || batch.length === 0) {
          setSettled(true);
          return;
        }
        const filled: Record<string, any[]> = {};
        for (const c of upcoming) {
          if (cancelled) break;
          try {
            const id = routeIdOf(c as any);
            if (prefetched[id]) continue;
            const matched = matchContentForCourse(batch, c as any);
            if (Array.isArray(matched) && matched.length > 0) {
              filled[id] = matched;
              void saveCourseContentRaw(id, matched);
            }
          } catch {}
        }
        if (!cancelled) {
          if (Object.keys(filled).length > 0) {
            setPrefetched(prev => ({ ...prev, ...filled }));
          }
          setSettled(true);
        }
      } catch {
        if (!cancelled) setSettled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  useEffect(() => {
    onEmptyStateChange?.(false);
  }, [onEmptyStateChange]);

  useEffect(() => {
    if (!onTargetChange) return;
    // « Afficher plus » -> flux Contenus et ressources complet.
    onTargetChange(RESSOURCES_HREF);
  }, [onTargetChange]);

  const recent = useMemo(
    () => findRecentCoursesWithContent(courses as any[], prefetched, 2),
    [courses, prefetched]
  );
  const nextCourse = useMemo(() => findNextCourse(courses as any[]), [courses]);

  // 1) Chargement : skeleton (jamais de vide éclair ni de texte figé).
  if (!settled && recent.length === 0) {
    return <LessonContentSkeleton />;
  }

  // 2) Hero : dernière séance avec contenu (+2e en ligne compacte).
  if (recent.length > 0) {
    const first = recent[0];
    const color = getSubjectColor(first.subject);
    const chapter = (first.content ?? [])[0];
    const totalFiles = recent.reduce(
      (n: number, c: any) =>
        n +
        (Array.isArray(c.content)
          ? c.content.reduce(
              (m: number, ch: any) => m + (ch.attachments?.length ?? 0),
              0
            )
          : 0),
      0
    );
    const second = recent[1];
    return (
      <HeroShell
        accent={color}
        emoji={getSubjectEmoji(first.subject)}
        title={getSubjectName(first.subject)}
        subtitle={relDateTime(first.from)}
        badge={
          totalFiles > 0
            ? t("Home_LessonContent_Files", "{{count}} fichiers", {
                count: totalFiles,
              })
            : undefined
        }
      >
        {!!chapter?.title && (
          <Typography variant="body1" weight="bold" numberOfLines={1}>
            {chapter.title}
          </Typography>
        )}
        {!!chapter?.description && (
          <Typography variant="body2" color="secondary" numberOfLines={2}>
            {stripHtml(chapter.description)}
          </Typography>
        )}
        {second && (
          <Stack direction="horizontal" vAlign="center" gap={8}>
            <Text style={{ fontSize: 16 }}>
              {getSubjectEmoji(second.subject)}
            </Text>
            <Typography variant="body2" weight="bold" numberOfLines={1} style={{ flex: 1 }}>
              {getSubjectName(second.subject)}
            </Typography>
            <Typography variant="caption" color="secondary" numberOfLines={1}>
              {relDateTime(second.from)}
            </Typography>
          </Stack>
        )}
      </HeroShell>
    );
  }

  // 3) Cours futurs mais rien publié : vide honnête.
  if (nextCourse) {
    return (
      <HeroShell
        accent={getSubjectColor((nextCourse as any).subject)}
        emoji={getSubjectEmoji((nextCourse as any).subject)}
        title={getSubjectName((nextCourse as any).subject)}
        subtitle={relDateTime((nextCourse as any).from)}
      >
        <Typography variant="body2" color="secondary" numberOfLines={2}>
          {t(
            "Home_LessonContent_NoContent_Desc",
            "Aucun contenu publié pour ce cours."
          )}
        </Typography>
      </HeroShell>
    );
  }

  // 4) Vrai vide : aucun cours futur.
  return (
    <HeroShell
      accent="#29947A"
      title={t("Home_LessonContent_Empty_Title", "Rien pour l'instant")}
      subtitle={t(
        "Home_LessonContent_Empty_Desc",
        "Les contenus publiés par tes profs apparaîtront ici."
      )}
    />
  );
});

LessonContentWidget.displayName = "LessonContentWidget";

export default LessonContentWidget;
