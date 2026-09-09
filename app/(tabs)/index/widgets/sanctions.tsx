import { Papicons } from "@getpapillon/papicons";
import { Link } from "expo-router";
import { t } from "i18next";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { getManager, subscribeManagerUpdate } from "@/services/shared";
import { Attendance } from "@/services/shared/attendance";
import Icon from "@/ui/components/Icon";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import { getCurrentPeriod } from "@/utils/grades/helper/period";
import { error } from "@/utils/logger/logger";

type SanctionsWidgetProps = {
  onEmptyStateChange?: (isEmpty: boolean) => void;
};

/** Carte "Vie scolaire" : absences/retards non justifiés + punitions. Vide = calme. */

const SanctionsWidget = React.memo(({ onEmptyStateChange }: SanctionsWidgetProps) => {
  const manager = getManager();

  const [attendances, setAttendances] = useState<Attendance[]>([]);

  const fetchSanctions = useCallback(async (managerToUse = manager) => {
    if (!managerToUse) {
      return;
    }
    try {
      const periods = await managerToUse.getAttendancePeriods();
      if (periods.length === 0) {
        return;
      }
      const current = getCurrentPeriod(periods);
      if (!current) {
        return;
      }
      const data = await managerToUse.getAttendanceForPeriod(current.name);
      setAttendances(Array.isArray(data) ? data : []);
    } catch (err) {
      error(`Failed to fetch widget sanctions: ${String(err)}`);
    }
  }, [manager]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) {
        return;
      }
      await fetchSanctions();
    })();
    const unsubscribe = subscribeManagerUpdate((updatedManager) => {
      if (!cancelled) {
        void fetchSanctions(updatedManager);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchSanctions]);

  let unjustifiedCount = 0;
  for (const attendance of attendances) {
    for (const absence of attendance.absences) {
      if (!absence.justified) {
        unjustifiedCount += 1;
      }
    }
    for (const delay of attendance.delays) {
      if (!delay.justified) {
        unjustifiedCount += 1;
      }
    }
    unjustifiedCount += attendance.punishments.length;
  }

  useEffect(() => {
    onEmptyStateChange?.(false);
  }, [onEmptyStateChange]);

  if (unjustifiedCount === 0) {
    return (
      <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
        <Link href="(features)/sanctions" asChild>
          <Link.AppleZoom>
            <Stack gap={10} padding={[16, 14]} radius={18} card>
              <Stack direction="horizontal" vAlign="center" hAlign="center" gap={12}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "#29947A14",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon papicon opacity={0.85} size={24}>
                    <Papicons name="Check" />
                  </Icon>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Typography variant="title" weight="bold" numberOfLines={1}>
                    {t("Home_Sanctions_Empty_Title", "Rien à signaler")}
                  </Typography>
                  <Typography variant="body2" color="secondary" numberOfLines={2}>
                    {t("Home_Sanctions_Empty_Desc", "Aucune absence, retard ou punition sur la période.")}
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
        href="(features)/sanctions"
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
                  backgroundColor: "#E05D3414",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon papicon opacity={0.85} size={24}>
                  <Papicons name="AlertTriangle" />
                </Icon>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="title" weight="bold" numberOfLines={1}>
                  {unjustifiedCount === 1
                    ? t("Home_Sanctions_Count_Singular")
                    : t("Home_Sanctions_Count_Plural", { count: unjustifiedCount })}
                </Typography>
                <Typography variant="body2" color="secondary" numberOfLines={1}>
                  {t("Home_Sanctions_Subtitle", "Vie scolaire · période en cours")}
                </Typography>
              </View>
            </Stack>
            <Typography variant="caption" color="primary">
            </Typography>
          </Stack>
        </Link.AppleZoom>
      </Link>
    </View>
  );
});

SanctionsWidget.displayName = "SanctionsWidget";

export default SanctionsWidget;
