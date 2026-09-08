import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import { t } from "i18next";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDate, formatDistanceToNowStrict } from "date-fns";
import * as DateLocale from "date-fns/locale";

import { getManager, subscribeManagerUpdate } from "@/services/shared";
import { Attendance, Punishment } from "@/services/shared/attendance";
import { Period } from "@/services/shared/grade";
import ActionMenu from "@/ui/components/ActionMenu";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import Icon from "@/ui/components/Icon";
import Stack from "@/ui/components/Stack";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import adjust from "@/utils/adjustColor";
import { getCurrentPeriod } from "@/utils/grades/helper/period";
import i18n from "@/utils/i18n";
import { error } from "@/utils/logger/logger";
import { getPeriodName, getPeriodNumber, isPeriodWithNumber } from "@/utils/services/periods";

const lz = (num: number): string => num.toString().padStart(2, "0");

const formatDuration = (durationMinutes: number, detailed: boolean): string => {
  if (detailed) {
    return durationMinutes >= 60
      ? t("Attendance_Duration_HoursMinutes_Detailed", { hours: Math.floor(durationMinutes / 60), minutes: lz(durationMinutes % 60) })
      : t("Attendance_Duration_Minutes", { value: durationMinutes });
  }
  return durationMinutes >= 60
    ? t("Attendance_Duration_HoursMinutes_Compact", { hours: Math.floor(durationMinutes / 60), minutes: lz(durationMinutes % 60) })
    : t("Attendance_Duration_Minutes", { value: durationMinutes });
};

const SanctionsView: React.FC = () => {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  const [headerHeight, setHeaderHeight] = useState(0);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [period, setPeriod] = useState<Period | undefined>(undefined);
  const [attendances, setAttendances] = useState<Attendance[]>([]);

  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPeriods = useCallback(async () => {
    const manager = getManager();
    if (!manager) {
      setLoadingPeriods(false);
      return;
    }
    try {
      const result = await manager.getAttendancePeriods();
      setPeriods(result);
      if (result.length > 0) {
        setPeriod(prev => prev ?? getCurrentPeriod(result));
      }
    } catch (e) {
      error(`Failed to fetch attendance periods: ${String(e)}`);
    } finally {
      setLoadingPeriods(false);
    }
  }, []);

  const fetchDataForPeriod = useCallback(async (target: Period | undefined) => {
    if (!target) {
      return;
    }
    const manager = getManager();
    if (!manager) {
      return;
    }
    setLoadingData(true);
    try {
      const data = await manager.getAttendanceForPeriod(target.name);
      setAttendances(Array.isArray(data) ? data : []);
    } catch (e) {
      error(`Failed to fetch sanctions: ${String(e)}`);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void fetchPeriods();
    const unsubscribe = subscribeManagerUpdate(() => {
      void fetchPeriods();
    });
    return () => unsubscribe();
  }, [fetchPeriods]);

  useEffect(() => {
    void fetchDataForPeriod(period);
  }, [period, fetchDataForPeriod]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (periods.length === 0) {
        await fetchPeriods();
      }
      await fetchDataForPeriod(period);
    } finally {
      setRefreshing(false);
    }
  }, [periods.length, fetchPeriods, fetchDataForPeriod, period]);

  const selectPeriod = useCallback((periodId: string) => {
    const selected = periods.find(item => String(item.id ?? "") === periodId);
    if (!selected) {
      error(t("Attendance_InvalidPeriod"));
      return;
    }
    setPeriod(selected);
  }, [periods]);

  const stats = useMemo(() => {
    let unjustifiedAbsences = 0;
    let unjustifiedDelays = 0;
    let unjustifiedTime = 0;
    let punishmentCount = 0;
    for (const attendance of attendances) {
      for (const absence of attendance.absences) {
        if (!absence.justified) {
          unjustifiedAbsences += 1;
          unjustifiedTime += absence.timeMissed;
        }
      }
      for (const delay of attendance.delays) {
        if (!delay.justified) {
          unjustifiedDelays += 1;
          unjustifiedTime += delay.duration;
        }
      }
      punishmentCount += attendance.punishments.length;
    }
    return { unjustifiedAbsences, unjustifiedDelays, unjustifiedTime, punishmentCount };
  }, [attendances]);

  const punishments = useMemo(() => {
    const all: Punishment[] = [];
    for (const attendance of attendances) {
      all.push(...attendance.punishments);
    }
    return all.sort((a, b) => new Date(b.givenAt).getTime() - new Date(a.givenAt).getTime());
  }, [attendances]);

  const dangerColor = adjust("#C50000", theme.dark ? 0.4 : -0.1);
  const dangerBg = adjust("#C50000", theme.dark ? -0.65 : 0.85);
  const successColor = adjust("#00C851", theme.dark ? 0.3 : -0.1);
  const successBg = adjust("#00C851", theme.dark ? -0.75 : 0.85);

  const loading = loadingPeriods || loadingData;
  const hasUnjustified = stats.unjustifiedAbsences + stats.unjustifiedDelays + stats.punishmentCount > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader
        showAndroidBackButton
        modal={Platform.OS !== "android"}
        onHeightChanged={setHeaderHeight}
        title={
          <ActionMenu
            key={String(period?.id ?? "")}
            onPressAction={({ nativeEvent }) => {
              const actionId = nativeEvent.event;
              if (actionId.startsWith("period:")) {
                selectPeriod(actionId.replace("period:", ""));
              }
            }}
            actions={periods.map((item) => ({
              id: "period:" + String(item.id ?? ""),
              title: (getPeriodName(item.name || "") + " " + (isPeriodWithNumber(item.name || "") ? getPeriodNumber(item.name || "0") : "")).trim(),
              subtitle: `${new Date(item.start).toLocaleDateString(i18n.language, {
                month: "short",
                year: "numeric",
              })} - ${new Date(item.end).toLocaleDateString(i18n.language, {
                month: "short",
                year: "numeric",
              })}`,
              state: String(period?.id ?? "") === String(item.id ?? "") ? "on" : "off",
              image: Platform.select({
                ios: (getPeriodNumber(item.name || "0")) + ".calendar",
              }),
              imageColor: colors.text,
            }))}
          >
            <TabHeaderTitle
              chevron={periods.length > 1}
              leading={periods.length > 0 ? getPeriodName(period?.name ?? "") : t("Sanctions_Title")}
              number={period && isPeriodWithNumber(period.name || "") ? getPeriodNumber(period.name || "") : undefined}
              loading={loading}
            />
          </ActionMenu>
        }
      />

      {loadingPeriods ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <List
          contentContainerStyle={{
            padding: 16,
            paddingTop: headerHeight,
            paddingBottom: insets.bottom + 16,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressViewOffset={headerHeight}
            />
          }
        >
          {loadingData ? (
            <List.View>
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 32 }}>
                <ActivityIndicator />
              </View>
            </List.View>
          ) : !hasUnjustified ? (
            <List.Item>
              <List.Leading>
                <Icon>
                  <Papicons name="Ghost" />
                </Icon>
              </List.Leading>
              <Typography variant="title">
                {t("Sanctions_Empty_Title")}
              </Typography>
              <Typography color="textSecondary">
                {t("Sanctions_Empty_Description")}
              </Typography>
            </List.Item>
          ) : (
            <List.Section>
              {stats.unjustifiedTime > 0 || stats.punishmentCount > 0 ? (
                <List.Item
                  style={{
                    backgroundColor: dangerBg,
                  }}
                >
                  <List.Leading>
                    <Icon fill={dangerColor}>
                      <Papicons name="AlertTriangle" />
                    </Icon>
                  </List.Leading>
                  <Typography variant="title" color={dangerColor}>
                    {stats.unjustifiedTime > 0
                      ? t("Attendance_Hours_Unjustified_Value", { duration: formatDuration(stats.unjustifiedTime, true) })
                      : t("Sanctions_Count_Plural", { count: stats.punishmentCount })}
                  </Typography>
                  <Typography color={dangerColor}>
                    {t("Attendance_Unjustified_Description")}
                  </Typography>
                </List.Item>
              ) : (
                <List.Item
                  style={{
                    backgroundColor: successBg,
                  }}
                >
                  <List.Leading>
                    <Icon fill={successColor}>
                      <Papicons name="Check" />
                    </Icon>
                  </List.Leading>
                  <Typography variant="title" color={successColor}>
                    {t("Attendance_NoUnjustified_Title")}
                  </Typography>
                  <Typography color={successColor}>
                    {t("Attendance_NoUnjustified_Description")}
                  </Typography>
                </List.Item>
              )}

              <List.Item>
                <Typography variant="action">
                  {t("Attendance_Hours_Missed")}
                </Typography>
                <List.Trailing>
                  <Typography variant="title" weight="bold" color={stats.unjustifiedTime > 0 ? dangerColor : "textSecondary"}>
                    {formatDuration(stats.unjustifiedTime, true)}
                  </Typography>
                </List.Trailing>
              </List.Item>

              <List.Item>
                <Typography variant="action">
                  {t("Sanctions_Punishments")}
                </Typography>
                <List.Trailing>
                  <Typography variant="title" weight="bold" color={stats.punishmentCount > 0 ? dangerColor : "textSecondary"}>
                    {stats.punishmentCount}
                  </Typography>
                </List.Trailing>
              </List.Item>
            </List.Section>
          )}

          {!loadingData && punishments.map((punishment) => (
            <PunishmentCard
              key={punishment.id}
              punishment={punishment}
              dangerColor={dangerColor}
              dangerBg={dangerBg}
            />
          ))}
        </List>
      )}
    </View>
  );
};

const PunishmentCard: React.FC<{ punishment: Punishment; dangerColor: string; dangerBg: string }> = ({ punishment, dangerColor, dangerBg }) => {
  const givenDate = new Date(punishment.givenAt);
  const dateString = formatDistanceToNowStrict(givenDate, {
    locale: DateLocale[i18n.language as keyof typeof DateLocale] || DateLocale.enUS,
    addSuffix: true,
  });
  const dayString = formatDate(givenDate, "eeee d MMMM", {
    locale: DateLocale[i18n.language as keyof typeof DateLocale] || DateLocale.enUS,
  });

  const durationMinutes = punishment.durationMinutes ?? punishment.duration ?? 0;
  const documentCount = punishment.homework.documents.length + punishment.reason.documents.length;

  return (
    <List.Section>
      <List.SectionTitle>
        <Icon opacity={0.5} size={20}>
          <Papicons name="AlertTriangle" />
        </Icon>
        <Typography variant="body1" weight="semibold" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
          {punishment.nature || t("Sanctions_Punishments")}
        </Typography>
        {punishment.exclusion && (
          <View style={{ padding: 6, paddingHorizontal: 12, backgroundColor: dangerBg, borderRadius: 25, overflow: "hidden" }}>
            <Typography variant="caption" weight="bold" color={dangerColor}>
              {t("Sanctions_Exclusion")}
            </Typography>
          </View>
        )}
      </List.SectionTitle>

      <List.Item>
        <Typography variant="title" numberOfLines={2}>
          {punishment.reason.text || t("Attendance_NoReason")}
        </Typography>
        <Typography color="textSecondary" numberOfLines={1}>
          {dateString} · {dayString}
        </Typography>
        {punishment.givenBy ? (
          <Typography variant="caption" color="textSecondary" numberOfLines={1}>
            {t("Sanctions_GivenBy", { name: punishment.givenBy })}
          </Typography>
        ) : null}
        <List.Trailing>
          <Stack direction="horizontal" hAlign="center" gap={8}>
            <View style={{ padding: 6, paddingHorizontal: 12, backgroundColor: dangerBg, borderRadius: 25, overflow: "hidden" }}>
              <Typography variant="title" color={dangerColor}>
                {formatDuration(durationMinutes, false)}
              </Typography>
            </View>
          </Stack>
        </List.Trailing>
      </List.Item>

      {punishment.reason.circumstances ? (
        <List.Item>
          <List.Leading>
            <Icon>
              <Papicons name="Info" />
            </Icon>
          </List.Leading>
          <Typography variant="title">
            {t("Sanctions_Circumstances")}
          </Typography>
          <Typography color="textSecondary">
            {punishment.reason.circumstances}
          </Typography>
        </List.Item>
      ) : null}

      {punishment.homework.text ? (
        <List.Item>
          <List.Leading>
            <Icon>
              <Papicons name="Info" />
            </Icon>
          </List.Leading>
          <Typography variant="title">
            {t("Sanctions_Homework")}
          </Typography>
          <Typography color="textSecondary">
            {punishment.homework.text}
          </Typography>
        </List.Item>
      ) : null}

      {(punishment.duringLesson || punishment.schedulable || documentCount > 0) && (
        <List.Item>
          <Typography variant="body1" color="textSecondary" numberOfLines={3}>
            {[
              punishment.duringLesson ? t("Sanctions_DuringLesson") : null,
              punishment.schedulable ? t("Sanctions_Schedulable") : null,
              documentCount > 0 ? t("Sanctions_Documents", { count: documentCount }) : null,
            ].filter(Boolean).join(" · ")}
          </Typography>
        </List.Item>
      )}
    </List.Section>
  );
};

export default SanctionsView;
