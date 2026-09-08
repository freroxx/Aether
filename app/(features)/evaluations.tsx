import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import { t } from "i18next";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getManager, subscribeManagerUpdate } from "@/services/shared";
import { Evaluation, Period, Report } from "@/services/shared/grade";
import ActionMenu from "@/ui/components/ActionMenu";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import Icon from "@/ui/components/Icon";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import { getCurrentPeriod } from "@/utils/grades/helper/period";
import i18n from "@/utils/i18n";
import { error } from "@/utils/logger/logger";
import { getPeriodName, getPeriodNumber, isPeriodWithNumber } from "@/utils/services/periods";
import { getSubjectColor } from "@/utils/subjects/colors";
import { getSubjectName } from "@/utils/subjects/name";
import { getAcquisitionColor } from "@/utils/evaluations";

const EvaluationsView: React.FC = () => {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  const [headerHeight, setHeaderHeight] = useState(0);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<Period | undefined>(undefined);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [report, setReport] = useState<Report | null>(null);

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
      const result = await manager.getGradesPeriods();
      const sorted = [...result].sort((a, b) => {
        const aKey = a.name.startsWith("Semestre") || a.name.startsWith("Trimestre");
        const bKey = b.name.startsWith("Semestre") || b.name.startsWith("Trimestre");
        if (aKey && !bKey) { return -1; }
        if (!aKey && bKey) { return 1; }
        return a.start.getTime() - b.start.getTime();
      });
      setPeriods(sorted);
      if (sorted.length > 0) {
        setCurrentPeriod(prev => prev ?? getCurrentPeriod(sorted));
      }
    } catch (e) {
      error(`Failed to fetch evaluation periods: ${String(e)}`);
    } finally {
      setLoadingPeriods(false);
    }
  }, []);

  const fetchDataForPeriod = useCallback(async (period: Period | undefined) => {
    if (!period) {
      return;
    }
    const manager = getManager();
    if (!manager) {
      return;
    }
    setLoadingData(true);
    try {
      const [evals, rep] = await Promise.all([
        manager.getEvaluationsForPeriod(period, period.createdByAccount),
        manager.getReportForPeriod(period, period.createdByAccount),
      ]);
      setEvaluations(Array.isArray(evals) ? evals : []);
      setReport(rep ?? null);
    } catch (e) {
      error(`Failed to fetch evaluations/report: ${String(e)}`);
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
    void fetchDataForPeriod(currentPeriod);
  }, [currentPeriod, fetchDataForPeriod]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (periods.length === 0) {
        await fetchPeriods();
      }
      await fetchDataForPeriod(currentPeriod);
    } finally {
      setRefreshing(false);
    }
  }, [periods.length, fetchPeriods, fetchDataForPeriod, currentPeriod]);

  const selectPeriod = useCallback(async (periodId: string) => {
    const selected = periods.find(item => String(item.id ?? "") === periodId);
    if (!selected) {
      error(t("Attendance_InvalidPeriod"));
      return;
    }
    setCurrentPeriod(selected);
  }, [periods]);

  const groupedEvaluations = useMemo(() => {
    const groups = new Map<string, { subject: string; items: Evaluation[] }>();
    const sorted = [...evaluations].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });
    for (const item of sorted) {
      const key = item.subject || "?";
      const group = groups.get(key);
      if (group) {
        group.items.push(item);
      } else {
        groups.set(key, { subject: item.subject, items: [item] });
      }
    }
    return [...groups.values()];
  }, [evaluations]);

  const emptyJoke = useMemo(() => {
    const pool = [
      t("Evaluations_Empty_Funny_1"),
      t("Evaluations_Empty_Funny_2"),
      t("Evaluations_Empty_Funny_3"),
      t("Evaluations_Empty_Funny_4"),
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  const loading = loadingPeriods || loadingData;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TabHeader
        showAndroidBackButton
        modal={Platform.OS !== "android"}
        onHeightChanged={setHeaderHeight}
        title={
          <ActionMenu
            onPressAction={({ nativeEvent }) => {
              const actionId = nativeEvent.event;
              if (actionId.startsWith("period:")) {
                void selectPeriod(actionId.replace("period:", ""));
              }
            }}
            actions={periods.map((period) => ({
              id: "period:" + String(period.id ?? ""),
              title: (getPeriodName(period.name || "") + " " + (isPeriodWithNumber(period.name || "") ? getPeriodNumber(period.name || "0") : "")).trim(),
              subtitle: `${new Date(period.start).toLocaleDateString(i18n.language, {
                month: "short",
                year: "numeric",
              })} - ${new Date(period.end).toLocaleDateString(i18n.language, {
                month: "short",
                year: "numeric",
              })}`,
              state: String(currentPeriod?.id ?? "") === String(period.id ?? "") ? "on" : "off",
              image: Platform.select({
                ios: (getPeriodNumber(period.name || "0")) + ".calendar",
              }),
              imageColor: colors.text,
            }))}
          >
            <TabHeaderTitle
              leading={periods.length > 0 ? getPeriodName(currentPeriod?.name || "") : t("Evaluations_Title")}
              number={currentPeriod && isPeriodWithNumber(currentPeriod.name || "") ? getPeriodNumber(currentPeriod.name || "") : undefined}
              loading={loading}
              chevron={periods.length > 1}
            />
          </ActionMenu>
        }
      />

      {loadingPeriods ? (
        <View style={styles.centerContainer}>
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
              <View style={styles.centerContainer}>
                <ActivityIndicator />
              </View>
            </List.View>
          ) : (
            <>
              <List.Section>
                <List.SectionTitle>
                  <Icon opacity={0.5} size={20}>
                    <Papicons name="Certificate" />
                  </Icon>
                  <Typography variant="body1" weight="semibold" color="textSecondary" style={{ flex: 1 }}>
                    {t("Evaluations_Tab_Skills")}
                  </Typography>
                  {groupedEvaluations.length > 0 && (
                    <Typography variant="title" weight="medium" color="textSecondary">
                      {t("Evaluations_Count", { count: evaluations.length })}
                    </Typography>
                  )}
                </List.SectionTitle>

                {groupedEvaluations.length === 0 && (
                  <List.Item>
                    <List.Leading>
                      <Icon>
                        <Papicons name="Ghost" />
                      </Icon>
                    </List.Leading>
                    <Typography variant="title">
                      {t("Evaluations_Empty_Title")}
                    </Typography>
                    <Typography color="textSecondary">
                      {emptyJoke}
                    </Typography>
                  </List.Item>
                )}
              </List.Section>

              {groupedEvaluations.map((group) => (
                <EvaluationGroup
                  key={group.subject}
                  subject={group.subject}
                  items={group.items}
                />
              ))}

              <List.Section>
                <List.SectionTitle>
                  <Icon opacity={0.5} size={20}>
                    <Papicons name="FileText" />
                  </Icon>
                  <Typography variant="body1" weight="semibold" color="textSecondary" style={{ flex: 1 }}>
                    {t("Evaluations_Tab_Report")}
                  </Typography>
                </List.SectionTitle>

                {report === null && (
                  <List.Item>
                    <List.Leading>
                      <Icon>
                        <Papicons name="Ghost" />
                      </Icon>
                    </List.Leading>
                    <Typography variant="title">
                      {t("Evaluations_Report_Unpublished_Title")}
                    </Typography>
                    <Typography color="textSecondary">
                      {t("Evaluations_Report_Unpublished_Description")}
                    </Typography>
                  </List.Item>
                )}
              </List.Section>

              {report !== null && <ReportContent report={report} />}
            </>
          )}
        </List>
      )}
    </View>
  );
};

const EvaluationGroup: React.FC<{ subject: string; items: Evaluation[] }> = ({ subject, items }) => {
  const subjectColor = getSubjectColor(subject);
  return (
    <List.Section>
      <List.SectionTitle>
        <View style={[styles.dot, { backgroundColor: subjectColor }]} />
        <Typography variant="body1" weight="semibold" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
          {getSubjectName(subject)}
        </Typography>
        <Typography variant="title" weight="medium" color="textSecondary">
          {items.length}
        </Typography>
      </List.SectionTitle>

      {items.map((item) => (
        <EvaluationItem key={item.id} item={item} subjectColor={subjectColor} />
      ))}
    </List.Section>
  );
};

const EvaluationItem: React.FC<{ item: Evaluation; subjectColor: string }> = ({ item, subjectColor }) => {
  const dateString = useMemo(() => {
    if (!item.date) {
      return undefined;
    }
    const d = new Date(item.date);
    if (isNaN(d.getTime())) {
      return undefined;
    }
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }, [item.date]);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (item.teacher) {
      parts.push(item.teacher);
    }
    if (dateString) {
      parts.push(dateString);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }, [item.teacher, dateString]);

  return (
    <List.Item>
      <Typography variant="title" numberOfLines={2}>
        {item.name || item.description || t("Evaluations_Title")}
      </Typography>
      {subtitle ? (
        <Typography color="textSecondary" numberOfLines={1}>
          {subtitle}
        </Typography>
      ) : null}
      {item.description && item.name ? (
        <Typography variant="body1" color="textSecondary" numberOfLines={2}>
          {item.description}
        </Typography>
      ) : null}
      {item.acquisitions.length > 0 && (
        <View style={styles.pillsRow}>
          {item.acquisitions.map((acq, index) => {
            const pillColor = getAcquisitionColor(acq.level, acq.abbreviation, subjectColor);
            return (
              <View
                key={`${acq.name}-${index}`}
                style={[
                  styles.badge,
                  { backgroundColor: pillColor + "30" },
                ]}
              >
                <Typography variant="title" weight="bold" style={{ color: pillColor }} numberOfLines={1}>
                  {acq.abbreviation || acq.level || acq.name}
                </Typography>
              </View>
            );
          })}
        </View>
      )}
      <List.Trailing>
        <View style={[styles.badge, { backgroundColor: subjectColor + "30" }]}>
          <Typography variant="title" weight="bold" style={{ color: subjectColor }}>
            {t("Evaluations_Coefficient", { value: item.coefficient })}
          </Typography>
        </View>
      </List.Trailing>
    </List.Item>
  );
};

const formatAverage = (value: number): string =>
  value.toLocaleString(i18n.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const ReportContent: React.FC<{ report: Report }> = ({ report }) => {
  return (
    <>
      {report.comments.length > 0 && (
        <List.Section>
          <List.SectionTitle>
            <Icon opacity={0.5} size={20}>
              <Papicons name="Info" />
            </Icon>
            <Typography variant="body1" weight="semibold" color="textSecondary" style={{ flex: 1 }}>
              {t("Evaluations_Report_Comments")}
            </Typography>
          </List.SectionTitle>
          {report.comments.map((comment, index) => (
            <List.Item key={`comment-${index}`}>
              <Typography variant="body1">
                {comment}
              </Typography>
            </List.Item>
          ))}
        </List.Section>
      )}

      {report.subjects.map((subject, index) => {
        const subjectColor = subject.color || getSubjectColor(subject.name);
        const hasClass = typeof subject.classAverage === "number";
        const hasMinMax =
          typeof subject.minAverage === "number" &&
          typeof subject.maxAverage === "number";
        return (
          <List.Section key={`${subject.name}-${index}`}>
            <List.SectionTitle>
              <View style={[styles.dot, { backgroundColor: subjectColor }]} />
              <Typography variant="body1" weight="semibold" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
                {getSubjectName(subject.name)}
              </Typography>
              {typeof subject.coefficient === "number" && (
                <View style={[styles.badge, styles.smallBadge, { backgroundColor: subjectColor + "30" }]}>
                  <Typography variant="caption" weight="bold" style={{ color: subjectColor }}>
                    {t("Evaluations_Coefficient", { value: subject.coefficient })}
                  </Typography>
                </View>
              )}
              {typeof subject.studentAverage === "number" && (
                <Typography variant="title" weight="bold" style={{ color: subjectColor }}>
                  {formatAverage(subject.studentAverage)}
                </Typography>
              )}
            </List.SectionTitle>

            {hasClass && (
              <List.Item>
                <Typography variant="action">
                  {t("Evaluations_Average_Class")}
                </Typography>
                <List.Trailing>
                  <Typography variant="title" weight="bold" color="textSecondary">
                    {formatAverage(subject.classAverage as number)}
                  </Typography>
                </List.Trailing>
              </List.Item>
            )}

            {hasMinMax && (
              <List.Item>
                <Typography variant="action">
                  {t("Evaluations_Average_Min")} – {t("Evaluations_Average_Max")}
                </Typography>
                <List.Trailing>
                  <Typography variant="title" weight="bold" color="textSecondary">
                    {formatAverage(subject.minAverage as number)} – {formatAverage(subject.maxAverage as number)}
                  </Typography>
                </List.Trailing>
              </List.Item>
            )}

            {subject.teachers.length > 0 && (
              <List.Item>
                <Typography variant="action">
                  {t("Modal_Course_Teacher")}
                </Typography>
                <Typography color="textSecondary" numberOfLines={2}>
                  {subject.teachers.join(", ")}
                </Typography>
              </List.Item>
            )}

            {subject.comments.map((comment, commentIndex) => (
              <List.Item key={`subject-${index}-comment-${commentIndex}`}>
                <Typography variant="body1">
                  {comment}
                </Typography>
              </List.Item>
            ))}
          </List.Section>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 6,
    paddingHorizontal: 12,
    borderRadius: 25,
    overflow: "hidden",
  },
  smallBadge: {
    padding: 4,
    paddingHorizontal: 10,
  },
});

export default EvaluationsView;
