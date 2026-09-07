import { Papicons } from "@getpapillon/papicons";
import { Link } from "expo-router";
import { t } from "i18next";
import React, { useEffect, useMemo } from "react";
import { View } from "react-native";

import { getCourseRouteId } from "@/database/useTimetable";
import Icon from "@/ui/components/Icon";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import { getSubjectName } from "@/utils/subjects/name";
import { useTimetableWidgetData } from "../hooks/useTimetableWidgetData";

type LessonContentWidgetProps = {
  onEmptyStateChange?: (isEmpty: boolean) => void;
};

/**
 * Carte "Contenu et ressources" : affiche le contenu du prochain cours
 * qui en possède (cahier de textes). Masquée s'il n'y en a aucun.
 */
const LessonContentWidget = React.memo(({ onEmptyStateChange }: LessonContentWidgetProps) => {
  const { courses } = useTimetableWidgetData();

  const nextWithContent = useMemo(() => {
    const now = Date.now();
    return (courses ?? []).find(
      c =>
        new Date(c.to ?? c.from).getTime() > now &&
        Array.isArray(c.content) &&
        c.content.length > 0
    );
  }, [courses]);

  useEffect(() => {
    onEmptyStateChange?.(!nextWithContent);
  }, [nextWithContent, onEmptyStateChange]);

  if (!nextWithContent) return null;

  const items = (nextWithContent.content ?? []).slice(0, 2);
  const fileCount = (nextWithContent.content ?? []).reduce(
    (n, c) => n + (c.attachments?.length ?? 0),
    0
  );

  return (
    <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
      <Link
        href={{
          pathname: "/(modals)/course/[id]",
          params: { id: getCourseRouteId(nextWithContent) },
        }}
        asChild
      >
        <Link.AppleZoom>
          <Stack gap={8} padding={[12, 12]} radius={18} card>
            <Stack direction="horizontal" vAlign="center" hAlign="center" gap={8}>
              <Icon papicon opacity={0.7}>
                <Papicons name="Info" />
              </Icon>
              <Typography variant="title" weight="bold" style={{ flex: 1 }} numberOfLines={1}>
                {getSubjectName(nextWithContent.subject)}
              </Typography>
              {fileCount > 0 && (
                <Typography variant="caption" color="secondary">
                  {t("Home_LessonContent_Files", "{{count}} fichiers", { count: fileCount })}
                </Typography>
              )}
            </Stack>
            {items.map((c, i) => (
              <View key={`${c.title ?? ""}-${i}`}>
                {!!c.title && (
                  <Typography variant="body1" weight="bold" numberOfLines={1}>
                    {c.title}
                  </Typography>
                )}
                {!!c.description && (
                  <Typography variant="body2" color="secondary" numberOfLines={2}>
                    {c.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
                  </Typography>
                )}
              </View>
            ))}
            <Typography variant="caption" color="primary">
              {t("Home_LessonContent_CTA", "Voir le contenu du cours")}
            </Typography>
          </Stack>
        </Link.AppleZoom>
      </Link>
    </View>
  );
});

LessonContentWidget.displayName = "LessonContentWidget";

export default LessonContentWidget;
