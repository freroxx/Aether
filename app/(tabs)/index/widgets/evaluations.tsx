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

/**
 * Carte "Évaluations" : nombre d'évaluations de la période en cours
 * et domaine le plus fragile. Masquée s'il n'y en a aucune.
 */
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
      const current: Period = getCurrentPeriod(periods);
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
    onEmptyStateChange?.(evaluations.length === 0);
  }, [evaluations.length, onEmptyStateChange]);

  if (evaluations.length === 0) {
    return null;
  }

  return (
    <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
      <Link
        href="(features)/evaluations"
        asChild
      >
        <Link.AppleZoom>
          <Stack gap={8} padding={[12, 12]} radius={18} card>
            <Stack direction="horizontal" vAlign="center" hAlign="center" gap={8}>
              <Icon papicon opacity={0.7}>
                <Papicons name="Grades" />
              </Icon>
              <Typography variant="title" weight="bold" style={{ flex: 1 }} numberOfLines={1}>
                {evaluations.length === 1
                  ? t("Home_Evaluations_Count_Singular")
                  : t("Home_Evaluations_Count_Plural", { count: evaluations.length })}
              </Typography>
            </Stack>
            {weakestDomain ? (
              <Typography variant="body2" color="secondary" numberOfLines={2}>
                {t("Home_Evaluations_Weakest", { domain: weakestDomain })}
              </Typography>
            ) : null}
            <Typography variant="caption" color="primary">
              {t("Home_Display_More")}
            </Typography>
          </Stack>
        </Link.AppleZoom>
      </Link>
    </View>
  );
});

EvaluationsWidget.displayName = "EvaluationsWidget";

export default EvaluationsWidget;
