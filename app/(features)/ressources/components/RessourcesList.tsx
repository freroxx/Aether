import { t } from "i18next";
import React, { useCallback } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import Reanimated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "expo-router/react-navigation";

import { hapticFor } from "@/utils/haptics";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import List from "@/ui/new/List";
import { AetherAppearIn, AetherAppearOut } from "@/ui/utils/Transition";
import useResizable from "@/ui/utils/Resizable";

import type {
  BuiltAttachment,
  DaySection,
  SessionItem,
} from "../hooks/useRessourcesData";
import DayHeader from "./DayHeader";
import SessionCard, { RESSOURCES_ACCENT } from "./SessionCard";

interface RessourcesListProps {
  sections: DaySection[];
  headerHeight: number;
  headerExtra: React.ReactNode;
  isRefreshing: boolean;
  onRefresh: () => void;
  isFiltering: boolean;
  loadError: boolean;
  offline: boolean;
  collapsedGroups: string[];
  onToggleGroup: (id: string) => void;
  downloadingKey: string | null;
  onOpenFile: (attachment: BuiltAttachment, dueDate: Date) => void;
  onOpenHomework: (routeId: string) => void;
}

/** Libellé relatif honnête : Aujourd'hui / Hier / Demain, sinon date complète. */
function relativeTitle(key: string, fallback: string): {
  title: string;
  subtitle?: string;
} {
  try {
    const parts = key.split("-").map((n) => Number(n));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
      return { title: fallback };
    }
    const day = new Date(parts[0], parts[1], parts[2]);
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round(
      (day.getTime() - today.getTime()) / 86400000
    );
    if (diff === 0)
      return {
        title: t("Ressources_Today", "Aujourd'hui"),
        subtitle: fallback,
      };
    if (diff === -1)
      return { title: t("Ressources_Yesterday", "Hier"), subtitle: fallback };
    if (diff === 1)
      return { title: t("Ressources_Tomorrow", "Demain"), subtitle: fallback };
    return { title: fallback };
  } catch {
    return { title: fallback };
  }
}

const RessourcesList: React.FC<RessourcesListProps> = ({
  sections,
  headerHeight,
  headerExtra,
  isRefreshing,
  onRefresh,
  isFiltering,
  loadError,
  offline,
  collapsedGroups,
  onToggleGroup,
  downloadingKey,
  onOpenFile,
  onOpenHomework,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isLarge } = useResizable();
  const numColumns = isLarge ? 2 : 1;

  const renderSession = useCallback(
    (session: SessionItem) => (
      <Reanimated.View
        layout={LinearTransition}
        entering={AetherAppearIn}
        exiting={AetherAppearOut}
      >
        <SessionCard
          session={session}
          downloadingKey={downloadingKey}
          onOpenFile={onOpenFile}
          onOpenHomework={onOpenHomework}
        />
      </Reanimated.View>
    ),
    [downloadingKey, onOpenFile, onOpenHomework]
  );

  const showError = loadError && sections.length === 0;

  return (
    <List
      key={`ressources-list-${numColumns}`}
      animated
      numColumns={numColumns}
      maintainVisibleContentPosition={{ disabled: true }}
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 8,
        paddingLeft: insets.left + 16,
      }}
      scrollIndicatorInsets={{
        top: headerHeight - insets.top,
      }}
      ListEmptyComponent={
        showError ? (
          <Stack gap={10} vAlign="center" hAlign="center" padding={32}>
            <Typography variant="h4" align="center">
              {t("Ressources_Error_Title", "Chargement impossible")}
            </Typography>
            <Typography variant="body1" color="secondary" align="center">
              {t(
                "Ressources_Error_Details",
                "Vérifie ta connexion puis réessaie."
              )}
            </Typography>
            <Pressable
              onPress={() => {
                void hapticFor("selection");
                onRefresh();
              }}
              style={({ pressed }) => [
                {
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                  borderRadius: 300,
                  backgroundColor: `${RESSOURCES_ACCENT}1A`,
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              accessibilityRole="button"
            >
              <Typography
                variant="button"
                style={{ color: RESSOURCES_ACCENT }}
              >
                {t("Ressources_Retry", "Réessayer")}
              </Typography>
            </Pressable>
          </Stack>
        ) : (
          <Stack gap={8} vAlign="center" hAlign="center" padding={32}>
            <Typography variant="h4" align="center">
              {t("Ressources_Empty_Title", "Aucune ressource")}
            </Typography>
            <Typography variant="body1" color="secondary" align="center">
              {isFiltering
                ? t(
                    "Ressources_Empty_Filter",
                    "Essaie d'élargir les filtres ou la période."
                  )
                : t(
                    "Ressources_Empty_Details",
                    "Les contenus de cours et pièces jointes apparaîtront ici."
                  )}
            </Typography>
          </Stack>
        )
      }
      ListHeaderComponent={
        <>
          {offline && (
            <View
              style={{
                marginTop: headerHeight,
                flexDirection: "row",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 300,
                  backgroundColor: `${String(colors.text)}0A`,
                }}
              >
                <Typography variant="caption" color="secondary">
                  {t(
                    "Ressources_Offline",
                    "Hors-ligne — données en cache"
                  )}
                </Typography>
              </View>
            </View>
          )}
          {headerExtra}
        </>
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          progressViewOffset={headerHeight - insets.top}
          tintColor={String(colors.primary)}
        />
      }
    >
      {sections.map((section) => {
        const isCollapsed = collapsedGroups.includes(section.key);
        const chapters = section.lessons.reduce(
          (n, l) => n + l.contents.length,
          0
        );
        const files = section.lessons.reduce((n, l) => n + l.fileCount, 0);
        const rel = relativeTitle(section.key, section.dateLabel);
        const summary = [
          rel.subtitle,
          `${section.lessons.length} ${t("Ressources_Sessions", "séances")}`,
          `${chapters} ${t("Ressources_Chapters", "chapitres")}`,
          files > 0
            ? `${files} ${t("Ressources_FilesSuffix", "fichiers")}`
            : "",
        ]
          .filter((s) => (s ?? "").length > 0)
          .join(" · ");
        return (
          <Reanimated.View key={section.key} layout={LinearTransition}>
            <DayHeader
              title={rel.title}
              subtitle={summary}
              isCollapsed={isCollapsed}
              onToggle={() => {
                void hapticFor("selection");
                onToggleGroup(section.key);
              }}
            />
            {!isCollapsed &&
              section.lessons.map((session) => (
                <React.Fragment key={session.key}>
                  {renderSession(session)}
                </React.Fragment>
              ))}
          </Reanimated.View>
        );
      })}
    </List>
  );
};

export default RessourcesList;
