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

const LessonContentWidget = React.memo(({ onEmptyStateChange, onTargetChange }: LessonContentWidgetProps) => {
  const { courses } = useTimetableWidgetData();
  const theme = useTheme();

  const nextWithContent = useMemo(() => findNextCourseWithContent(courses as any[]), [courses]);

  useEffect(() => {
    onEmptyStateChange?.(false);
  }, [onEmptyStateChange]);

  useEffect(() => {
    if (!onTargetChange) return;
    if (nextWithContent) {
      onTargetChange({
        pathname: "/(modals)/course/[id]",
        params: { id: getCourseRouteId(nextWithContent as any) },
      });
    } else {
      onTargetChange("(tabs)/calendar");
    }
  }, [nextWithContent, onTargetChange]);

  if (!nextWithContent) {
    return (
      <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
        <Link href="(tabs)/calendar" asChild>
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

  const items = (nextWithContent.content ?? []).slice(0, 2);
  const fileCount = (nextWithContent.content ?? []).reduce(
    (n: number, c: any) => n + (c.attachments?.length ?? 0),
    0
  );
  const subject = getSubjectName(nextWithContent.subject);
  const color = getSubjectColor(nextWithContent.subject);
  const emoji = getSubjectEmoji(nextWithContent.subject);

  return (
    <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
      <Link
        href={{
          pathname: "/(modals)/course/[id]",
          params: { id: getCourseRouteId(nextWithContent as any) },
        }}
        asChild
      >
        <Link.AppleZoom>
          <Stack gap={10} padding={[14, 14]} radius={18} card>
            <Stack direction="horizontal" vAlign="center" hAlign="center" gap={12}>
              <View
                style={{
                  width: 6,
                  alignSelf: "stretch",
                  backgroundColor: color,
                  borderRadius: 300,
                }}
              />
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
                  {t("Home_LessonContent_Title", "Contenu du prochain cours")}
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
                  <Typography variant="caption" color="secondary" numberOfLines={1}>
                    {c.attachments
                      .slice(0, 2)
                      .map((a: any) => a?.name ?? "Fichier")
                      .join(" · ")}
                    {c.attachments.length > 2 ? ` (+${c.attachments.length - 2})` : ""}
                  </Typography>
                )}
              </View>
            ))}
          </Stack>
        </Link.AppleZoom>
      </Link>
    </View>
  );
});

LessonContentWidget.displayName = "LessonContentWidget";

export default LessonContentWidget;
