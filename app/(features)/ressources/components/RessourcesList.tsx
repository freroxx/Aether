import { Papicons } from "@getpapillon/papicons";
import { t } from "i18next";
import React, { useCallback } from "react";
import { Platform, Pressable, RefreshControl, View } from "react-native";
import Reanimated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "expo-router/react-navigation";

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
import SessionCard from "./SessionCard";

interface RessourcesListProps {
  sections: DaySection[];
  headerHeight: number;
  headerExtra: React.ReactNode;
  isRefreshing: boolean;
  onRefresh: () => void;
  isFiltering: boolean;
  collapsedGroups: string[];
  onToggleGroup: (id: string) => void;
  downloadingKey: string | null;
  onOpenFile: (attachment: BuiltAttachment, dueDate: Date) => void;
  onOpenHomework: (routeId: string) => void;
}

const RessourcesList: React.FC<RessourcesListProps> = ({
  sections,
  headerHeight,
  headerExtra,
  isRefreshing,
  onRefresh,
  isFiltering,
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
      }
      ListHeaderComponent={<>{headerExtra}</>}
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
        return (
          <Reanimated.View key={section.key} layout={LinearTransition}>
            <Pressable
              onPress={() => onToggleGroup(section.key)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 6,
              }}
            >
              <Typography variant="h4" style={{ flex: 1 }}>
                {section.dateLabel}
              </Typography>
              <Typography variant="caption" color="secondary">
                {section.lessons.length}
              </Typography>
              <View
                style={{
                  opacity: 0.5,
                  transform: [{ rotate: isCollapsed ? "0deg" : "90deg" }],
                }}
              >
                <Papicons
                  name="chevronright"
                  size={18}
                  color={String(colors.text)}
                />
              </View>
            </Pressable>
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
