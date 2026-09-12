import { Period } from "@/services/shared/grade";
import { error, warn } from "@/utils/logger/logger";

export function getCurrentPeriod(periods: Period[]): Period | undefined {  const now = new Date().getTime();
  const excludedNames = [
    "Bac blanc",
    "Brevet blanc",
    "Hors période",
    "Année",
    "ANNÉE",
    "ANNEE",
    "Contrôle en cours de formation",
    "EPREUVES PONCTUELLES 1ERE SERIE",
    "EPREUVES PONCTUELLES 2EME SERIE",
    "MI-SEMESTRE 1",
    "MI-SEMESTRE 2",
    "Évaluation spécifique de DNL",
  ];

  const toTime = (value: unknown): number => {
    try {
      const t = value instanceof Date ? value.getTime() : new Date(value as any).getTime();
      return Number.isFinite(t) ? t : NaN;
    } catch {
      return NaN;
    }
  };

  periods = (Array.isArray(periods) ? periods : [])
    .filter(period => !!period && !excludedNames.includes(period.name))
    .sort((a, b) => toTime(a.start) - toTime(b.start));

  for (const period of periods) {
    if (toTime(period.start) < now && toTime(period.end) > now) {
      return period;
    }
  }

  if (periods.length > 0) {
    warn(
      "Current period not found. Falling back to the first period in the array."
    );
    return periods[0];
  }

  error("Unable to find the current period and unable to fallback...");
  return periods[0];
}

/**
 * Période courante backend d'abord (Pronote /periods/current), fallback heuristique locale.
 * Best-effort : jamais de throw, jamais de jank (appel court, catch silencieux).
 */
export async function resolveBackendCurrentPeriod(
  manager: { getCurrentPeriod?: () => Promise<Period | null> } | null | undefined,
  periods: Period[]
): Promise<Period | undefined> {
  if (Array.isArray(periods) && periods.length > 0) {
    try {
      const backend = await manager?.getCurrentPeriod?.();
      if (backend?.name) {
        const match =
          periods.find(p => p.id && backend.id && String(p.id) === String(backend.id)) ??
          periods.find(p => p.name === backend.name);
        if (match) return match;
      }
    } catch {
      // fallback local ci-dessous
    }
  }
  try {
    return getCurrentPeriod(periods);
  } catch {
    return periods[0];
  }
}