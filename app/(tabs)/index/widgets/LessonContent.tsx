import { Papicons } from "@getpapillon/papicons";
import { Link } from "expo-router";
import { t } from "i18next";
import React, { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { useTheme } from "expo-router/react-navigation";

import { getCourseRouteId } from "@/database/useTimetable";
import Icon from "@/ui/components/Icon";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import { getSubjectColor } from "@/utils/subjects/colors";
import { getSubjectEmoji } from "@/utils/subjects/emoji";
import { getSubjectName } from "@/utils/subjects/name";
import { getAttachmentIcon } from "@/utils/news/getAttachmentIcon";
import { useTimetableWidgetData } from "../hooks/useTimetableWidgetData";

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

/** Prochain cours futur, avec ou sans contenu (pour la redirection "Afficher plus"). */
export function findNextCourse(courses: any[] | undefined) {
  const now = Date.now();
  return (courses ?? [])
    .filter(c => c && new Date(c.to ?? c.from).getTime() > now)
    .sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())[0];
}

const LessonContentWidget = React.memo(({ onEmptyStateChange, onTargetChange }: LessonContentWidgetProps) => {
  const { courses } = useTimetableWidgetData();
  const theme = useTheme();
  const [prefetched, setPrefetched] = React.useState<Record<string, any[]>>({});

  const nextWithContent = useMemo(() => {
    const direct = findNextCourseWithContent(courses as any[]);
    if (direct) return direct;
    // Contenu pré-chargé en arrière-plan (EDT rapide sans contenu) :
    // si le prochain cours a un contenu fetché, l'afficher sans attendre la DB.
    try {
      const now = Date.now();
      const withPre = (courses as any[] ?? [])
        .filter(c => c && new Date(c.to ?? c.from).getTime() > now)
        .sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())
        .find(c => {
          try {
            const id = getCourseRouteId(c as any);
            return Array.isArray(prefetched[id]) && prefetched[id].length > 0;
          } catch {
            return false;
          }
        });
      if (withPre) {
        try {
          const id = getCourseRouteId(withPre as any);
          return { ...withPre, content: prefetched[id] };
        } catch {
          return withPre;
        }
      }
    } catch {}
    return direct;
  }, [courses, prefetched]);
  const nextCourse = useMemo(() => findNextCourse(courses as any[]), [courses]);

  // Pré-charge le contenu des 3 prochains cours (1 PageCahierDeTexte / cours,
  // en arrière-plan, best-effort) pour que le widget affiche les ressources
  // sans ouvrir chaque fiche cours.
  useEffect(() => {
    let cancelled = false;
    const upcoming = ((courses as any[]) ?? [])
      .filter(c => c && new Date(c.to ?? c.from).getTime() > Date.now())
      .sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())
      .slice(0, 3)
      .filter(c => !Array.isArray(c.content) || c.content.length === 0);
    if (upcoming.length === 0) return;
    (async () => {
      try {
        const { getManager } = await import("@/services/shared");
        const manager = getManager();
        if (!manager || cancelled) return;
        for (const c of upcoming) {
          if (cancelled) break;
          try {
            const id = getCourseRouteId(c as any);
            if (prefetched[id]) continue;
            const fresh = await (manager as any).getCourseResources(c);
            if (cancelled) break;
            if (Array.isArray(fresh) && fresh.length > 0) {
              setPrefetched(prev => ({ ...prev, [id]: fresh }));
            }
          } catch {}
        }
      } catch {}
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
    // "Afficher plus" -> fiche du prochain cours (avec contenu si possible),
    // jamais un simple renvoi vers l'EDT quand un cours existe.
    const target = nextWithContent ?? nextCourse;
    if (target) {
      try {
        onTargetChange({
          pathname: "/(modals)/course/[id]",
          params: { id: getCourseRouteId(target as any) },
        });
      } catch {
        onTargetChange("/(tabs)/calendar");
      }
    } else {
      onTargetChange("/(tabs)/calendar");
    }
  }, [nextWithContent, nextCourse, onTargetChange]);

  // Aucun cours futur du tout -> renvoi EDT (vrai vide).
  if (!nextWithContent && !nextCourse) {
    return (
      <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
        <Link href="/(tabs)/calendar" asChild>
          <Link.AppleZoom>
            <Stack gap={10} padding={[16, 14]} radius={18} card>
              <Stack direction="horizontal" vAlign="center" hAlign="center" gap={12}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: `${String(theme.colors.primary)}14`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon papicon opacity={0.7}>
                    <Papicons name="Info" />
                  </Icon>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Typography variant="title" weight="bold" numberOfLines={1}>
                    {t("Home_LessonContent_Empty_Title", "Rien pour l'instant")}
                  </Typography>
                  <Typography variant="body2" color="secondary" numberOfLines={2}>
                    {t("Home_LessonContent_Empty_Desc", "Aucun contenu publié pour tes prochains cours.")}
                  </Typography>
                </View>
              </Stack>
              <Typography variant="caption" color="primary">
                {t("Home_LessonContent_Empty_CTA", "Voir l'emploi du temps")}
              </Typography>
            </Stack>
          </Link.AppleZoom>
        </Link>
      </View>
    );
  }

  // Prochain cours sans contenu (chargement en cours ou rien publié) :
  // on affiche quand même la fiche cours (jamais un simple renvoi EDT).
  const effectiveCourse = nextWithContent ?? nextCourse;
  if (!nextWithContent && nextCourse) {
    const ncSubject = getSubjectName((nextCourse as any).subject);
    const ncColor = getSubjectColor((nextCourse as any).subject);
    const ncEmoji = getSubjectEmoji((nextCourse as any).subject);
    let ncDate = "";
    try {
      const d = new Date((nextCourse as any).from);
      const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      ncDate = `${day} · ${hh}h${mm}`;
    } catch {}
    return (
      <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
        <Link
          href={{
            pathname: "/(modals)/course/[id]",
            params: { id: getCourseRouteId(nextCourse as any) },
          }}
          asChild
        >
          <Link.AppleZoom>
            <Stack gap={10} padding={[14, 14]} radius={18} card style={{ paddingLeft: 24 }}>
              <View
                style={{
                  position: "absolute",
                  left: 10,
                  top: 14,
                  bottom: 14,
                  width: 6,
                  backgroundColor: ncColor,
                  borderRadius: 300,
                }}
              />
              <Stack direction="horizontal" vAlign="center" hAlign="center" gap={12}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: `${ncColor}1F`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{ncEmoji}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Typography variant="title" weight="bold" numberOfLines={1}>
                    {ncSubject}
                  </Typography>
                  <Typography variant="body2" color="secondary" numberOfLines={1}>
                    {ncDate}
                  </Typography>
                </View>
              </Stack>
              <View
                style={{
                  gap: 2,
                  backgroundColor: `${String(theme.colors.text)}0A`,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Typography variant="body2" color="secondary" numberOfLines={2}>
                  {t("Home_LessonContent_Pending_Desc", "Contenu en cours de chargement — ouvre la fiche pour voir les ressources.")}
                </Typography>
              </View>
              <Stack direction="horizontal" vAlign="center" hAlign="center" gap={6}>
                <Typography variant="caption" weight="bold" color="primary" style={{ flex: 1 }} numberOfLines={1}>
                  {t("Home_LessonContent_CTA", "Ouvrir le cours")}
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

  const items = (effectiveCourse.content ?? []).slice(0, 2);
  const fileCount = (effectiveCourse.content ?? []).reduce(
    (n: number, c: any) => n + (c.attachments?.length ?? 0),
    0
  );
  const subject = getSubjectName(effectiveCourse.subject);
  const color = getSubjectColor(effectiveCourse.subject);
  const emoji = getSubjectEmoji(effectiveCourse.subject);
  const courseDate = useMemo(() => {
    try {
      const d = new Date((effectiveCourse as any).from);
      const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${day} · ${hh}h${mm}`;
    } catch {
      return "";
    }
  }, [effectiveCourse]);

  return (
    <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
      <Link
        href={{
          pathname: "/(modals)/course/[id]",
          params: { id: getCourseRouteId(effectiveCourse as any) },
        }}
        asChild
      >
        <Link.AppleZoom>
          <Stack gap={10} padding={[14, 14]} radius={18} card style={{ paddingLeft: 24 }}>
            <View
              style={{
                position: "absolute",
                left: 10,
                top: 14,
                bottom: 14,
                width: 6,
                backgroundColor: color,
                borderRadius: 300,
              }}
            />
            <Stack direction="horizontal" vAlign="center" hAlign="center" gap={12}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: `${color}1F`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="title" weight="bold" numberOfLines={1}>
                  {subject}
                </Typography>
                <Typography variant="body2" color="secondary" numberOfLines={1}>
                  {courseDate || t("Home_LessonContent_Title", "Contenu du prochain cours")}
                </Typography>
              </View>
              {fileCount > 0 && (
                <View
                  style={{
                    backgroundColor: `${color}1A`,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                  }}
                >
                  <Typography variant="caption" weight="bold">
                    {t("Home_LessonContent_Files", "{{count}} fichiers", { count: fileCount })}
                  </Typography>
                </View>
              )}
            </Stack>
            {items.map((c: any, i: number) => (
              <View
                key={`${c.title ?? ""}-${i}`}
                style={{
                  gap: 2,
                  backgroundColor: `${String(theme.colors.text)}0A`,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                {!!c.title && (
                  <Typography variant="body1" weight="bold" numberOfLines={1}>
                    {c.title}
                  </Typography>
                )}
                {!!c.description && (
                  <Typography variant="body2" color="secondary" numberOfLines={2}>
                    {String(c.description).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
                  </Typography>
                )}
                {Array.isArray(c.attachments) && c.attachments.length > 0 && (
                  <Stack direction="horizontal" vAlign="center" hAlign="center" gap={6}>
                    <Icon papicon opacity={0.5} size={14}>
                      <Papicons name={getAttachmentIcon(c.attachments[0]) as any} />
                    </Icon>
                    <Typography variant="caption" color="secondary" style={{ flex: 1 }} numberOfLines={1}>
                      {c.attachments
                        .slice(0, 2)
                        .map((a: any) => a?.name ?? "Fichier")
                        .join(" · ")}
                      {c.attachments.length > 2 ? ` (+${c.attachments.length - 2})` : ""}
                    </Typography>
                  </Stack>
                )}
              </View>
            ))}
            <Stack direction="horizontal" vAlign="center" hAlign="center" gap={6}>
              <Typography variant="caption" weight="bold" color="primary" style={{ flex: 1 }} numberOfLines={1}>
                {t("Home_LessonContent_CTA", "Ouvrir le cours")}
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
});

LessonContentWidget.displayName = "LessonContentWidget";

export default LessonContentWidget;
