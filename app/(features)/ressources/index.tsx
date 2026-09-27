import { useTheme } from "expo-router/react-navigation";
import { t } from "i18next";
import { Papicons } from "@getpapillon/papicons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getWeekNumberFromDate } from "@/database/useHomework";
import { getManager } from "@/services/shared";
import {
  openAttachment,
  resolvePronoteFileAuth,
} from "@/services/pronote/files";
import { useAlert } from "@/ui/components/AlertProvider";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import ChipButton from "@/ui/components/ChipButton";
import MainTabErrorBoundary from "@/ui/components/MainTabErrorBoundary";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import useResizable from "@/ui/utils/Resizable";

import RessourcesHeader from "./components/RessourcesHeader";
import RessourcesList from "./components/RessourcesList";
import { RESSOURCES_ACCENT } from "./components/SessionCard";
import {
  useRessourcesData,
  type BuiltAttachment,
  type ViewMode,
} from "./hooks/useRessourcesData";
import { useRessourcesFilters } from "./hooks/useRessourcesFilters";

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
  const [downloading, setDownloading] = useState<string | null>(null);

  const headerHeight =
    insets.top + (isLarge ? 70 : 118) + (Platform.OS === "android" ? 6 : 0);

  const {
    sections,
    subjects,
    themes,
    totalResources,
    loading,
    refreshing,
    refresh,
  } = useRessourcesData(viewMode, selectedWeek, fromDate);

  const {
    searchTerm,
    setSearchTerm,
    selectedSubject,
    setSelectedSubject,
    selectedTheme,
    setSelectedTheme,
    collapsedGroups,
    toggleGroup,
    filtered,
    isFiltering,
  } = useRessourcesFilters(sections);

  // Période courante -> depuis = début de trimestre (borné pour le backend 62j).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const manager = getManager();
        if (!manager?.getCurrentPeriod) return;
        const period = await manager.getCurrentPeriod().catch(() => null);
        const raw = (period as unknown as { start?: unknown })?.start;
        const d =
          raw instanceof Date
            ? raw
            : (() => {
                try {
                  const v = new Date(raw as never);
                  return isNaN(v.getTime()) ? null : v;
                } catch {
                  return null;
                }
              })();
        if (!d || cancelled) return;
        const diffDays = Math.round(
          (Date.now() - d.getTime()) / 86400000
        );
        if (diffDays > 0 && diffDays <= 62) {
          const nd = new Date(d);
          nd.setHours(0, 0, 0, 0);
          setFromDate(nd);
        }
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openFile = useCallback(
    (attachment: BuiltAttachment, dueDate?: Date) => {
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
      } catch {
        /* ignore */
      }
    }
  }, []);

  const weekLabel = useMemo(() => String(selectedWeek), [selectedWeek]);

  const depuisLabel = useMemo(() => {
    try {
      return fromDate.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
    } catch {
      return "";
    }
  }, [fromDate]);

  const themeActions = useMemo(
    () => [
      {
        title: t("Ressources_Theme_Title", "Thème"),
        subactions: [
          {
            title: t("Ressources_AllThemes", "Tous les thèmes"),
            id: "theme:all",
            state: (selectedTheme === "all" ? "on" : "off") as "on" | "off",
          },
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

  const headerExtra = useMemo(
    () => (
      <View style={{ marginTop: headerHeight, gap: 12, paddingBottom: 4 }}>
        <Stack direction="horizontal" gap={8} vAlign="center">
          {viewMode === "weekly" ? (
            <>
              <Pressable
                onPress={() => setSelectedWeek((w) => Math.max(1, w - 1))}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                }}
                accessibilityLabel={t(
                  "Ressources_PrevWeek",
                  "Semaine précédente"
                )}
              >
                <Papicons
                  name="chevronleft"
                  size={20}
                  color={String(colors.text)}
                />
              </Pressable>
              <Pressable
                onPress={() => setSelectedWeek(defaultWeek)}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                }}
                accessibilityLabel={t("Ressources_ThisWeek", "Cette semaine")}
              >
                <Papicons
                  name="calendar"
                  size={20}
                  color={String(colors.text)}
                />
              </Pressable>
              <Pressable
                onPress={() => setSelectedWeek((w) => w + 1)}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                }}
                accessibilityLabel={t(
                  "Ressources_NextWeek",
                  "Semaine suivante"
                )}
              >
                <Papicons
                  name="chevronright"
                  size={20}
                  color={String(colors.text)}
                />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  const d = new Date(fromDate);
                  d.setDate(d.getDate() - 7);
                  setFromDate(d);
                }}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                }}
                accessibilityLabel={t(
                  "Ressources_Since_Earlier",
                  "Remonter plus tôt"
                )}
              >
                <Papicons
                  name="chevronleft"
                  size={20}
                  color={String(colors.text)}
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 14);
                  d.setHours(0, 0, 0, 0);
                  setFromDate(d);
                }}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                }}
                accessibilityLabel={t(
                  "Ressources_Since_Reset",
                  "Revenir à 14 jours"
                )}
              >
                <Papicons
                  name="calendar"
                  size={20}
                  color={String(colors.text)}
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  const d = new Date(fromDate);
                  d.setDate(d.getDate() + 7);
                  if (d.getTime() <= Date.now()) setFromDate(d);
                }}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                }}
                accessibilityLabel={t(
                  "Ressources_Since_Later",
                  "Période plus récente"
                )}
              >
                <Papicons
                  name="chevronright"
                  size={20}
                  color={String(colors.text)}
                />
              </Pressable>
            </>
          )}
          <View style={{ flex: 1 }} />
          <Typography variant="body1" color="secondary">
            {t("Ressources_Count", "{{count}} ressources", {
              count: totalResources,
            })}
          </Typography>
        </Stack>

        {subjects.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          >
            <Pressable
              onPress={() => setSelectedSubject("all")}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 300,
                backgroundColor:
                  selectedSubject === "all"
                    ? `${RESSOURCES_ACCENT}1A`
                    : colors.card,
                borderWidth: selectedSubject === "all" ? 1 : 0,
                borderColor: RESSOURCES_ACCENT,
              }}
            >
              <Typography
                variant="body1"
                color={
                  selectedSubject === "all" ? undefined : "secondary"
                }
                style={
                  selectedSubject === "all"
                    ? { color: RESSOURCES_ACCENT }
                    : undefined
                }
              >
                {t("Ressources_AllSubjects", "Toutes les matières")}
              </Typography>
            </Pressable>
            {subjects.map((s) => {
              const active = selectedSubject === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() =>
                    setSelectedSubject(active ? "all" : s.key)
                  }
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 300,
                    backgroundColor: active
                      ? `${s.color}22`
                      : colors.card,
                    borderWidth: active ? 1 : 0,
                    borderColor: s.color,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: s.color,
                    }}
                  />
                  <Typography variant="body1">
                    {s.pretty} · {s.count}
                  </Typography>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <Stack direction="horizontal" gap={8} vAlign="center">
          <ChipButton
            icon="filter"
            chevron
            onPressAction={({ nativeEvent }) => {
              const id = String(nativeEvent.event ?? "");
              if (id.startsWith("theme:"))
                setSelectedTheme(id.replace("theme:", ""));
            }}
            actions={themeActions as never}
          >
            {selectedTheme === "all"
              ? t("Ressources_AllThemes", "Tous les thèmes")
              : selectedTheme}
          </ChipButton>
        </Stack>
      </View>
    ),
    [
      headerHeight,
      viewMode,
      colors.card,
      colors.text,
      totalResources,
      subjects,
      selectedSubject,
      selectedTheme,
      themeActions,
      defaultWeek,
      fromDate,
    ]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RessourcesHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        titleNumber={
          viewMode === "weekly" ? weekLabel : String(totalResources)
        }
        subtitle={
          viewMode === "weekly" && selectedWeek === defaultWeek
            ? t("Tasks_ThisWeek", "Cette semaine")
            : viewMode === "chrono"
              ? t("Ressources_Since", "Depuis le {{date}}", {
                  date: depuisLabel,
                })
              : undefined
        }
        onSearchChange={setSearchTerm}
      />
      {loading && sections.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingTop: headerHeight,
          }}
        >
          <ActivityIndicator />
        </View>
      ) : (
        <RessourcesList
          sections={filtered}
          headerHeight={headerHeight}
          headerExtra={headerExtra}
          isRefreshing={refreshing}
          onRefresh={refresh}
          isFiltering={isFiltering}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
          downloadingKey={downloading}
          onOpenFile={openFile}
          onOpenHomework={openHomework}
        />
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
