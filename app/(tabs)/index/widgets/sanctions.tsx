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

/**
 * Carte "Sanctions" : absences/retards non justifiés + punitions
 * de la période en cours. Masquée s'il n'y en a aucune.
 */
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
    onEmptyStateChange?.(unjustifiedCount === 0);
  }, [unjustifiedCount, onEmptyStateChange]);

  if (unjustifiedCount === 0) {
    return null;
  }

  return (
    <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
      <Link
        href="(features)/sanctions"
        asChild
      >
        <Link.AppleZoom>
          <Stack gap={8} padding={[12, 12]} radius={18} card>
            <Stack direction="horizontal" vAlign="center" hAlign="center" gap={8}>
              <Icon papicon opacity={0.7}>
                <Papicons name="AlertTriangle" />
              </Icon>
              <Typography variant="title" weight="bold" style={{ flex: 1 }} numberOfLines={1}>
                {unjustifiedCount === 1
                  ? t("Home_Sanctions_Count_Singular")
                  : t("Home_Sanctions_Count_Plural", { count: unjustifiedCount })}
              </Typography>
            </Stack>
            <Typography variant="caption" color="primary">
              {t("Home_Display_More")}
            </Typography>
          </Stack>
        </Link.AppleZoom>
      </Link>
    </View>
  );
});

SanctionsWidget.displayName = "SanctionsWidget";

export default SanctionsWidget;
