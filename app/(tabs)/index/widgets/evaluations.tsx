import { Papicons } from "@getpapillon/papicons";
import { Link } from "expo-router";
import { t } from "i18next";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { getManager, subscribeManagerUpdate } from "@/services/shared";
import { Evaluation, Period } from "@/services/shared/grade";
import Icon from "@/ui/components/Icon";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import { getCurrentPeriod } from "@/utils/grades/helper/period";
import { scoreAcquisitionLevel } from "@/utils/evaluations";
import { error } from "@/utils/logger/logger";

type EvaluationsWidgetProps = {
  onEmptyStateChange?: (isEmpty: boolean) => void;
};

/** Carte "Évaluations" : nombre + domaine fragile. État vide calme et localisé. */

const EvaluationsWidget = React.memo(({ onEmptyStateChange }: EvaluationsWidgetProps) => {
  const manager = getManager();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

  const fetchEvaluations = useCallback(async (managerToUse = manager) => {
    if (!managerToUse) {
      return;
    }
    try {
      const periods = await managerToUse.getGradesPeriods();
      if (periods.length === 0) {
        return;
      }
      const current = getCurrentPeriod(periods);
      if (!current) {
        return;
      }
      const evals = await managerToUse.getEvaluationsForPeriod(current, current.createdByAccount);
      setEvaluations(Array.isArray(evals) ? evals : []);
    } catch (err) {
      error(`Failed to fetch widget evaluations: ${String(err)}`);
    }
  }, [manager]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) {
        return;
      }
      await fetchEvaluations();
    })();
    const unsubscribe = subscribeManagerUpdate((updatedManager) => {
      if (!cancelled) {
        void fetchEvaluations(updatedManager);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchEvaluations]);

  const weakestDomain = useMemo(() => {
    const byDomain = new Map<string, { total: number; count: number }>();
    for (const item of evaluations) {
      for (const acq of item.acquisitions) {
        const score = scoreAcquisitionLevel(acq.level, acq.abbreviation);
        if (score === null) {
          continue;
        }
        const key = acq.domain || acq.pillar || acq.name;
        if (!key) {
          continue;
        }
        const entry = byDomain.get(key);
        if (entry) {
          entry.total += score;
          entry.count += 1;
        } else {
          byDomain.set(key, { total: score, count: 1 });
        }
      }
    }
    let weakest: string | undefined;
    let weakestAvg = Number.POSITIVE_INFINITY;
    for (const [domain, entry] of byDomain) {
      const avg = entry.total / entry.count;
      if (avg < weakestAvg) {
        weakestAvg = avg;
        weakest = domain;
      }
    }
    return weakest;
  }, [evaluations]);

  useEffect(() => {
    onEmptyStateChange?.(false);
  }, [onEmptyStateChange]);

  if (evaluations.length === 0) {
    return (
      <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
        <Link href="(features)/evaluations" asChild>
          <Link.AppleZoom>
            <Stack gap={10} padding={[16, 14]} radius={18} card>
              <Stack direction="horizontal" vAlign="center" hAlign="center" gap={12}>
                <Icon papicon opacity={0.45} size={26}>
                  <Papicons name="Grades" />
                </Icon>
                <View style={{ flex: 1, gap: 2 }}>
                  <Typography variant="title" weight="bold" numberOfLines={1}>
                    {t("Home_Evaluations_Empty_Title", "Aucune évaluation")}
                  </Typography>
                  <Typography variant="body2" color="secondary" numberOfLines={2}>
                    {t("Home_Evaluations_Empty_Desc", "Tes compétences apparaîtront ici dès leur publication.")}
                  </Typography>
                </View>
              </Stack>
            </Stack>
          </Link.AppleZoom>
        </Link>
      </View>
    );
  }

  return (
    <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
      <Link
        href="(features)/evaluations"
        asChild
      >
        <Link.AppleZoom>
          <Stack gap={10} padding={[14, 14]} radius={18} card>
            <Stack direction="horizontal" vAlign="center" hAlign="center" gap={12}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#7C5CFF14",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon papicon opacity={0.85} size={24}>
                  <Papicons name="Grades" />
                </Icon>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="title" weight="bold" numberOfLines={1}>
                  {evaluations.length === 1
                    ? t("Home_Evaluations_Count_Singular")
                    : t("Home_Evaluations_Count_Plural", { count: evaluations.length })}
                </Typography>
                {weakestDomain ? (
                  <Typography variant="body2" color="secondary" numberOfLines={2}>
                    {t("Home_Evaluations_Weakest", { domain: weakestDomain })}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="secondary" numberOfLines={1}>
                    {t("Home_Evaluations_Subtitle", "Suivi de tes compétences")}
                  </Typography>
                )}
              </View>
            </Stack>
          </Stack>
        </Link.AppleZoom>
      </Link>
    </View>
  );
});

EvaluationsWidget.displayName = "EvaluationsWidget";

export default EvaluationsWidget;
