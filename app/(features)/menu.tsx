import { useTheme } from "expo-router/react-navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react-native";

import { CanteenMenu, Food, Meal } from "@/services/shared/canteen";
import { getManager } from "@/services/shared";
import { generateMockCanteenMenu } from "@/services/mock/data";
import { useAccountStore } from "@/stores/account";
import { error } from "@/utils/logger/logger";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import MaterialIcon from "@/ui/components/MaterialIcon";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import Typography from "@/ui/new/Typography";

interface MealCategoryConfig {
  key: keyof Meal;
  label: string;
  iconName: string;
  badgeBgDark: string;
  badgeBgLight: string;
  badgeTextDark: string;
  badgeTextLight: string;
}

const MEAL_CATEGORIES: MealCategoryConfig[] = [
  {
    key: "entry",
    label: "Entrée",
    iconName: "eco",
    badgeBgDark: "rgba(74, 155, 79, 0.2)",
    badgeBgLight: "rgba(74, 155, 79, 0.15)",
    badgeTextDark: "#81C784",
    badgeTextLight: "#2E7D32",
  },
  {
    key: "main",
    label: "Plat principal",
    iconName: "restaurant",
    badgeBgDark: "rgba(224, 93, 52, 0.2)",
    badgeBgLight: "rgba(224, 93, 52, 0.15)",
    badgeTextDark: "#FF8A65",
    badgeTextLight: "#D84315",
  },
  {
    key: "side",
    label: "Accompagnement",
    iconName: "grain",
    badgeBgDark: "rgba(36, 161, 122, 0.2)",
    badgeBgLight: "rgba(36, 161, 122, 0.15)",
    badgeTextDark: "#80CBC4",
    badgeTextLight: "#00695C",
  },
  {
    key: "cheese",
    label: "Fromage & Laitage",
    iconName: "egg",
    badgeBgDark: "rgba(226, 144, 53, 0.2)",
    badgeBgLight: "rgba(226, 144, 53, 0.15)",
    badgeTextDark: "#FFD54F",
    badgeTextLight: "#F57F17",
  },
  {
    key: "dessert",
    label: "Dessert",
    iconName: "cake",
    badgeBgDark: "rgba(217, 75, 100, 0.2)",
    badgeBgLight: "rgba(217, 75, 100, 0.15)",
    badgeTextDark: "#F48FB1",
    badgeTextLight: "#C2185B",
  },
  {
    key: "other",
    label: "Autres",
    iconName: "more-horiz",
    badgeBgDark: "rgba(158, 163, 178, 0.2)",
    badgeBgLight: "rgba(158, 163, 178, 0.15)",
    badgeTextDark: "#B0BEC5",
    badgeTextLight: "#546E7A",
  },
  {
    key: "drink",
    label: "Boisson",
    iconName: "local-cafe",
    badgeBgDark: "rgba(53, 104, 212, 0.2)",
    badgeBgLight: "rgba(53, 104, 212, 0.15)",
    badgeTextDark: "#90CAF9",
    badgeTextLight: "#1565C0",
  },
];

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function DishCard({
  category,
  foods,
  isDark,
}: {
  category: MealCategoryConfig;
  foods: Food[];
  isDark: boolean;
}) {
  const badgeBg = isDark ? category.badgeBgDark : category.badgeBgLight;
  const badgeText = isDark ? category.badgeTextDark : category.badgeTextLight;

  return (
    <View style={styles.categoryContainer}>
      <View style={styles.categoryHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: badgeBg }]}>
          <MaterialIcon
            name={category.iconName as any}
            size={14}
            color={badgeText}
          />
          <Typography
            variant="caption"
            weight="bold"
            style={{ color: badgeText, textTransform: "uppercase", letterSpacing: 0.6 }}
          >
            {category.label}
          </Typography>
        </View>
      </View>

      <View style={styles.dishesList}>
        {foods.map((food, idx) => {
          const rawLabels = (food as { labels?: unknown; allergens?: unknown }).labels
            ?? food.allergens
            ?? [];
          const labels: Array<string | { name?: string; color?: string | null }> = Array.isArray(rawLabels)
            ? (rawLabels as Array<string | { name?: string; color?: string | null }>)
            : [];
          return (
          <View
            key={`${food.name}-${idx}`}
            style={[
              styles.dishRow,
              idx > 0 && styles.dishSeparator,
              idx > 0 && { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Typography variant="body1" weight="medium">
                {food.name}
              </Typography>
              {labels.length > 0 && (
                <View style={styles.allergensContainer}>
                  {labels.map((allergen, allergenIdx) => {
                    const name = typeof allergen === "string" ? allergen : (allergen.name ?? "");
                    const color = typeof allergen === "string" ? undefined : (allergen.color ?? undefined);
                    if (!name) return null;
                    return (
                    <View
                      key={`${name}-${allergenIdx}`}
                      style={[
                        styles.allergenPill,
                        { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
                      ]}
                    >
                      {color ? (
                        <View style={[styles.allergenDot, { backgroundColor: color }]} />
                      ) : null}
                      <Typography variant="caption" color="textSecondary" style={{ fontSize: 10 }}>
                        {name}
                      </Typography>
                    </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
          );
        })}
      </View>
    </View>
  );
}

function MealBlock({
  meal,
  title,
  subtitle,
  iconName,
  isDark,
  cardBg,
}: {
  meal?: Meal;
  title: string;
  subtitle?: string;
  iconName: string;
  isDark: boolean;
  cardBg: string;
}) {
  if (!meal) return null;

  const validCategories = MEAL_CATEGORIES.map(category => {
    const foods = meal[category.key] as Food[] | undefined;
    if (!foods || foods.length === 0) return null;
    return { category, foods };
  }).filter((item): item is { category: MealCategoryConfig; foods: Food[] } => Boolean(item));

  if (validCategories.length === 0) return null;

  return (
    <View style={[styles.mealCard, { backgroundColor: cardBg }]}>
      <View style={styles.mealCardHeader}>
        <View style={[styles.mealIconContainer, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }]}>
          <MaterialIcon name={iconName as any} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Typography variant="title" weight="bold">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="textSecondary">
              {subtitle}
            </Typography>
          )}
        </View>
      </View>

      <View style={styles.categoriesWrapper}>
        {validCategories.map(({ category, foods }) => (
          <DishCard
            key={category.key}
            category={category}
            foods={foods}
            isDark={isDark}
          />
        ))}
      </View>
    </View>
  );
}

export default function CanteenMenuView() {
  const theme = useTheme();
  const isDark = theme.dark;
  const insets = useSafeAreaInsets();

  const [headerHeight, setHeaderHeight] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [menus, setMenus] = useState<CanteenMenu[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const todayDay = new Date().getDay();
    return todayDay >= 1 && todayDay <= 5 ? todayDay - 1 : 0;
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUsingMock, setIsUsingMock] = useState(false);

  const account = useAccountStore(state =>
    state.accounts.find(a => a.id === state.lastUsedAccount)
  );

  const monday = useMemo(() => {
    const base = startOfWeekMonday(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    const end = new Date(monday);
    end.setDate(end.getDate() + 4);
    return `${format(monday, "d MMMM", { locale: fr })} – ${format(end, "d MMMM yyyy", { locale: fr })}`;
  }, [monday]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [monday]);

  const load = useCallback(async () => {
    try {
      const manager = getManager();
      // Mocks TUÉS sur vrai compte : uniquement compte démo/invité
      const isDemoAccount = !account || (account.services?.length ?? 0) === 0;
      if (isDemoAccount) {
        setMenus(generateMockCanteenMenu(account?.id || "guest", monday));
        setIsUsingMock(true);
        return;
      }
      if (!manager) {
        setMenus([]);
        setIsUsingMock(false);
        return;
      }

      const data = await manager.getWeeklyCanteenMenu(monday);
      if (!data) {
        setMenus([]);
        setIsUsingMock(false);
      } else {
        setMenus([...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setIsUsingMock(false);
      }
    } catch (e) {
      error(String(e));
      setMenus([]);
      setIsUsingMock(false);
    }
  }, [monday, account]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const selectedDate = weekDays[selectedDayIndex] || weekDays[0];
  const currentDayMenu = menus.find(m => isSameDay(new Date(m.date), selectedDate));
  const isSelectedToday = isSameDay(selectedDate, new Date());

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <TabHeader
        showAndroidBackButton
        modal={Platform.OS !== "android"}
        onHeightChanged={setHeaderHeight}
        title={
          <TabHeaderTitle
            leading="Menu de la cantine"
            subtitle={weekLabel}
            loading={loading}
          />
        }
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: headerHeight + 8,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 16,
            gap: 14,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        >
          <View style={[styles.navCard, { backgroundColor: theme.colors.card }]}>
            <Pressable
              onPress={() => setWeekOffset(w => w - 1)}
              style={({ pressed }) => [
                styles.navArrowButton,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={8}
            >
              <ChevronLeft size={20} color={theme.colors.text} />
            </Pressable>

            <View style={styles.weekCenter}>
              <Typography variant="body1" weight="bold" align="center">
                {weekOffset === 0
                  ? "Cette semaine"
                  : weekOffset === -1
                  ? "Semaine dernière"
                  : weekOffset === 1
                  ? "Semaine prochaine"
                  : format(monday, "MMM yyyy", { locale: fr })}
              </Typography>
              {weekOffset !== 0 && (
                <Pressable
                  onPress={() => setWeekOffset(0)}
                  style={styles.resetWeekChip}
                >
                  <Typography
                    variant="caption"
                    weight="bold"
                    style={{ color: theme.colors.primary }}
                  >
                    Revenir à aujourd&apos;hui
                  </Typography>
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={() => setWeekOffset(w => w + 1)}
              style={({ pressed }) => [
                styles.navArrowButton,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={8}
            >
              <ChevronRight size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          <View style={styles.dayTabsContainer}>
            {weekDays.map((day, idx) => {
              const isSelected = selectedDayIndex === idx;
              const isToday = isSameDay(day, new Date());
              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => setSelectedDayIndex(idx)}
                  style={({ pressed }) => [
                    styles.dayTab,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primary
                        : theme.colors.card,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <Typography
                    variant="caption"
                    weight="bold"
                    style={{
                      color: isSelected
                        ? "#FFFFFF"
                        : isToday
                        ? theme.colors.primary
                        : theme.colors.text,
                      opacity: isSelected || isToday ? 1 : 0.7,
                      textTransform: "capitalize",
                    }}
                  >
                    {format(day, "EEE", { locale: fr }).slice(0, 3)}
                  </Typography>
                  <Typography
                    variant="title"
                    weight="bold"
                    style={{
                      color: isSelected ? "#FFFFFF" : theme.colors.text,
                      fontSize: 18,
                    }}
                  >
                    {format(day, "d")}
                  </Typography>
                  {isToday && (
                    <View
                      style={[
                        styles.todayDot,
                        {
                          backgroundColor: isSelected
                            ? "#FFFFFF"
                            : theme.colors.primary,
                        },
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dayTitleRow}>
            <View style={{ flex: 1 }}>
              <Typography variant="h3" weight="bold">
                {format(selectedDate, "EEEE d MMMM", { locale: fr })}
              </Typography>
              {isSelectedToday && (
                <Typography variant="caption" weight="bold" color="primary">
                  Menu du jour
                </Typography>
              )}
            </View>

            {isUsingMock && (
              <View
                style={[
                  styles.mockBadge,
                  {
                    backgroundColor: isDark
                      ? "rgba(41, 148, 122, 0.2)"
                      : "rgba(41, 148, 122, 0.12)",
                  },
                ]}
              >
                <Sparkles size={12} color="#29947A" />
                <Typography
                  variant="caption"
                  weight="bold"
                  style={{ color: "#29947A", fontSize: 11 }}
                >
                  Aperçu Démo
                </Typography>
              </View>
            )}
          </View>

          {currentDayMenu?.lunch || currentDayMenu?.dinner ? (
            <View style={{ gap: 14 }}>
              {currentDayMenu.lunch && (
                <MealBlock
                  meal={currentDayMenu.lunch}
                  title="Déjeuner"
                  subtitle="Service de midi"
                  iconName="lunch-dining"
                  isDark={isDark}
                  cardBg={theme.colors.card as string}
                />
              )}
              {currentDayMenu.dinner && (
                <MealBlock
                  meal={currentDayMenu.dinner}
                  title="Dîner"
                  subtitle="Service du soir (Internat)"
                  iconName="dinner-dining"
                  isDark={isDark}
                  cardBg={theme.colors.card as string}
                />
              )}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.colors.card }]}>
              <View
                style={[
                  styles.emptyIconCircle,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.04)",
                  },
                ]}
              >
                <UtensilsCrossed
                  size={36}
                  color={theme.colors.text}
                  style={{ opacity: 0.4 }}
                />
              </View>
              <Typography variant="title" weight="bold" align="center">
                Pas de service ce jour
              </Typography>
              <Typography
                variant="body1"
                color="textSecondary"
                align="center"
                style={{ maxWidth: 280 }}
              >
                Aucun menu n&apos;est publié pour cette journée. La cantine est
                peut-être fermée ou le menu n&apos;a pas encore été saisi.
              </Typography>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  navArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  weekCenter: {
    alignItems: "center",
    gap: 2,
  },
  resetWeekChip: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dayTabsContainer: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  dayTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 18,
    gap: 2,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  dayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 6,
  },
  mockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mealCard: {
    borderRadius: 24,
    padding: 18,
    gap: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  mealCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mealIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  categoriesWrapper: {
    gap: 14,
  },
  categoryContainer: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: "row",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dishesList: {
    gap: 2,
    paddingLeft: 4,
  },
  dishRow: {
    paddingVertical: 6,
  },
  dishSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  allergensContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  allergenPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  allergenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
});
