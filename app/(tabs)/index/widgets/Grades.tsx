import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { getManager, subscribeManagerUpdate } from "@/services/shared";
import { Period, Subject as SharedSubject } from "@/services/shared/grade";
import { resolveBackendCurrentPeriod } from "@/utils/grades/helper/period";
import { error } from "@/utils/logger/logger";
import Averages from "../../grades/atoms/Averages";
import { useSettingsStore } from "@/stores/settings";
import { useAccountStore } from "@/stores/account";
import { useSyncStore } from "@/stores/sync";
import { getGradeDisplayScale } from "@/utils/grades/scale";

const PERIODS_TTL_MS = 5 * 60 * 1000;
const GRADES_TTL_MS = 5 * 60 * 1000;

const periodsCache = new Map<
  string,
  {
    fetchedAt: number;
    value?: Period;
    inFlight?: Promise<Period | undefined>;
  }
>();

const gradesCache = new Map<
  string,
  {
    fetchedAt: number;
    subjects: SharedSubject[];
    serviceAverage?: number;
    inFlight?: Promise<{
      subjects: SharedSubject[];
      serviceAverage?: number;
    }>;
  }
>();

type GradesWidgetProps = {
  accent?: string;
  header?: boolean;
  algorithm?: "subject" | "weighted" | "median";
  period?: Period;
  onEmptyStateChange?: (isEmpty: boolean) => void;
};

const GradesWidget = ({ period, onEmptyStateChange }: GradesWidgetProps) => {
  try {
    const manager = getManager();

    const [subjects, setSubjects] = useState<SharedSubject[]>([]);
    const [currentPeriod, setCurrentPeriod] = useState<Period | undefined>(period);
    const [serviceAverage, setServiceAverage] = useState<number | undefined>(undefined);
    const [loaded, setLoaded] = useState(false);
    const displayScale = getGradeDisplayScale(useSettingsStore(state => state.personalization.gradesDisplayScale));
    // Clés de cache scopées (compte + enfant + epoch switch) : fini les notes de l'autre enfant.
    const selectedChild = useAccountStore(s => s.accounts.find(a => a.id === s.lastUsedAccount)?.selectedChild);
    const accountEpoch = useSyncStore(s => s.accountEpoch);
    const cacheScope = `${selectedChild ?? ""}::${accountEpoch}`;

    const grades = useMemo(
      () =>
        subjects
          .flatMap((subject) => subject.grades)
          .filter(
            (grade) =>
              grade.studentScore?.value !== undefined &&
              grade.givenAt &&
              !isNaN(grade.studentScore.value) &&
              !grade.studentScore.disabled,
          ),
      [subjects],
    );

    useEffect(() => {
      onEmptyStateChange?.(grades.length === 0);
    }, [grades.length, onEmptyStateChange]);

    const fetchPeriods = useCallback(
      async (managerToUse = manager) => {
        if (period) {
          setCurrentPeriod(period);
          return;
        }
        if (!managerToUse) {
          return;
        }

        const accountId = managerToUse.getAccount().id;
        const scopedAccountId = `${accountId}::${cacheScope}`;
        const cache = periodsCache.get(scopedAccountId);

        if (cache && Date.now() - cache.fetchedAt < PERIODS_TTL_MS) {
          if (cache.value) {
            setCurrentPeriod(cache.value);
          }
          return;
        }

        if (cache?.inFlight) {
          const cachedPeriod = await cache.inFlight;
          if (cachedPeriod) {
            setCurrentPeriod(cachedPeriod);
          }
          return;
        }

        const inFlight = (async () => {
          const result = await managerToUse.getGradesPeriods();
          return resolveBackendCurrentPeriod(managerToUse, result);
        })();

        periodsCache.set(scopedAccountId, {
          fetchedAt: cache?.fetchedAt ?? 0,
          value: cache?.value,
          inFlight,
        });

        try {
          const nextPeriod = await inFlight;
          periodsCache.set(scopedAccountId, {
            fetchedAt: Date.now(),
            value: nextPeriod,
          });
          if (nextPeriod) {
            setCurrentPeriod(nextPeriod);
          }
        } catch (err) {
          periodsCache.delete(scopedAccountId);
          error(`Failed to fetch periods: ${err}`);
        }
      },
      [period, manager, cacheScope],
    );

    useEffect(() => {
      const unsubscribe = subscribeManagerUpdate((updatedManager) => {
        fetchPeriods(updatedManager);
      });
      return () => unsubscribe();
    }, [fetchPeriods]);

    const fetchGradesForPeriod = useCallback(
      async (periodToFetch: Period | undefined, managerToUse = manager) => {
        if (!periodToFetch || !managerToUse) {
          setLoaded(true);
          return;
        }

        const periodKey = `${periodToFetch.createdByAccount}:${periodToFetch.name}:${cacheScope}`;
        const cache = gradesCache.get(periodKey);

        if (cache && Date.now() - cache.fetchedAt < GRADES_TTL_MS) {
          setSubjects(cache.subjects);
          setServiceAverage(cache.serviceAverage);
          setLoaded(true);
          return;
        }

        if (cache?.inFlight) {
          const cachedGrades = await cache.inFlight;
          setSubjects(cachedGrades.subjects);
          setServiceAverage(cachedGrades.serviceAverage);
          setLoaded(true);
          return;
        }

        const inFlight = (async () => {
          const result = await managerToUse.getGradesForPeriod(
            periodToFetch,
            periodToFetch.createdByAccount,
          );
          return {
            subjects: result.subjects,
            serviceAverage: result.studentOverall.value || undefined,
          };
        })();

        gradesCache.set(periodKey, {
          fetchedAt: cache?.fetchedAt ?? 0,
          subjects: cache?.subjects ?? [],
          serviceAverage: cache?.serviceAverage,
          inFlight,
        });

        try {
          const nextGrades = await inFlight;
          gradesCache.set(periodKey, {
            fetchedAt: Date.now(),
            subjects: nextGrades.subjects,
            serviceAverage: nextGrades.serviceAverage,
          });
          setSubjects(nextGrades.subjects);
          setServiceAverage(nextGrades.serviceAverage);
        } catch (err) {
          gradesCache.delete(periodKey);
          error(`Failed to fetch grades: ${err}`);
        } finally {
          setLoaded(true);
        }
      },
      [manager],
    );

    useEffect(() => {
      fetchGradesForPeriod(currentPeriod);
    }, [currentPeriod, fetchGradesForPeriod]);

    useEffect(() => {
      if (period) {
        setCurrentPeriod(period);
      }
    }, [period]);

    // Switch compte/enfant : vide l'UI tout de suite (skeleton), pas de stale.
    useEffect(() => {
      if (period) return;
      setSubjects([]);
      setServiceAverage(undefined);
      setCurrentPeriod(undefined);
      setLoaded(false);
      fetchPeriods();
    }, [cacheScope]); // eslint-disable-line react-hooks/exhaustive-deps

    if (grades.length === 0) {
      // Placeholder stable pendant le chargement (évite le pop-in/out de la carte)
      if (!loaded) {
        return (
          <View style={{ width: "100%", paddingTop: 4, paddingBottom: 12, height: 132, opacity: 0.5 }}>
            <Averages grades={[]} realAverage={undefined} inline displayScale={displayScale} />
          </View>
        );
      }
      return null;
    }

    return (
      <View style={{ width: "100%", paddingTop: 4, paddingBottom: 12 }}>
        <Averages grades={grades} realAverage={serviceAverage} inline displayScale={displayScale} />
      </View>
    );
  } catch (err) {
    error(`Error in GradesWidget: ${err}`);
    return null;
  }
};

export default GradesWidget;
