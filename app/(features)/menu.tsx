import { useTheme } from "expo-router/react-navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { CanteenMenu, Food, Meal } from "@/services/shared/canteen";
import { getManager } from "@/services/shared";
import { error } from "@/utils/logger/logger";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import Stack from "@/ui/components/Stack";

const MEAL_SECTIONS: Array<{ key: keyof Meal; label: string }> = [
  { key: "entry", label: "Entrée" },
  { key: "main", label: "Plat" },
  { key: "side", label: "Accompagnement" },
  { key: "cheese", label: "Fromage" },
  { key: "dessert", label: "Dessert" },
  { key: "drink", label: "Boisson" },
];

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function MealSection({ meal, title }: { meal?: Meal; title: string }) {
  if (!meal) {
    return null;
  }
  const parts = MEAL_SECTIONS.map(({ key, label }) => {
    const foods: Food[] | undefined = meal[key] as Food[] | undefined;
    if (!foods || foods.length === 0) {
      return null;
    }
    return (
      <View key={key} style={{ gap: 2 }}>
        <Typography variant="body1" weight="semibold" color="textSecondary">
          {label}
        </Typography>
        {foods.map((food, i) => (
          <Typography key={`${food.name}-${i}`} variant="body1">
            {food.name}
          </Typography>
        ))}
      </View>
    );
  }).filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 8, paddingVertical: 4 }}>
      <Typography variant="title">{title}</Typography>
      {parts}
    </View>
  );
}

export default function CanteenMenuView() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [menus, setMenus] = useState<CanteenMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const monday = useMemo(() => {
    const base = startOfWeekMonday(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    const end = new Date(monday);
    end.setDate(end.getDate() + 4);
    return `${format(monday, "d MMM", { locale: fr })} – ${format(end, "d MMM yyyy", { locale: fr })}`;
  }, [monday]);

  const load = useCallback(async () => {
    try {
      const manager = getManager();
      if (!manager) {
        return;
      }
      const data = await manager.getWeeklyCanteenMenu(monday);
      setMenus(data.sort((a, b) => a.date.getTime() - b.date.getTime()));
    } catch (e) {
      error(String(e));
    }
  }, [monday]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <TabHeader
        showAndroidBackButton
        modal={Platform.OS !== "android"}
        onHeightChanged={setHeaderHeight}
        title={
          <TabHeaderTitle
            leading="Cantine"
            subtitle={weekLabel}
            loading={loading}
          />
        }
      />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <List
          contentContainerStyle={{
            padding: 16,
            paddingTop: headerHeight + 8,
            paddingBottom: insets.bottom + 16,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <List.Section id="menu-nav">
            <List.View>
              <Stack direction="horizontal" gap={8}>
                <Typography
                  variant="body1"
                  color="primary"
                  onPress={() => setWeekOffset(w => w - 1)}
                >
                  ← Semaine précédente
                </Typography>
                <View style={{ flex: 1 }} />
                {weekOffset !== 0 && (
                  <Typography
                    variant="body1"
                    color="primary"
                    onPress={() => setWeekOffset(0)}
                  >
                    Cette semaine
                  </Typography>
                )}
                <View style={{ flex: 1 }} />
                <Typography
                  variant="body1"
                  color="primary"
                  onPress={() => setWeekOffset(w => w + 1)}
                >
                  Semaine suivante →
                </Typography>
              </Stack>
            </List.View>
          </List.Section>
          {menus.length === 0 && (
            <List.Section id="menu-empty">
              <List.View>
                <Typography variant="body1" color="secondary">
                  Aucun menu publié pour cette semaine.
                </Typography>
              </List.View>
            </List.Section>
          )}
          {menus.map(menu => (
            <List.Section
              key={menu.date.getTime()}
              id={`menu-${menu.date.getTime()}`}
            >
              <List.SectionTitle>
                <List.Label>
                  {format(menu.date, "EEEE d MMMM", { locale: fr })}
                </List.Label>
              </List.SectionTitle>
              <List.View>
                <MealSection meal={menu.lunch} title="Déjeuner" />
                <MealSection meal={menu.dinner} title="Dîner" />
                {!menu.lunch && !menu.dinner && (
                  <Typography variant="body1" color="secondary">
                    Pas de service ce jour.
                  </Typography>
                )}
              </List.View>
            </List.Section>
          ))}
        </List>
      )}
    </View>
  );
}
