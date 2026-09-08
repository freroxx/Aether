/**
 * Helpers partagés pour l'affichage des évaluations (socle de compétences).
 * Les niveaux viennent de pronotepy en texte libre (ex: "MI", "MF", "MS",
 * "TBM", "Non acquis", "En cours d'acquisition", "Acquis", "1".."4").
 * Le parsing est défensif : niveau inconnu -> null (couleur matière).
 */

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Score 1..4 ou null si le niveau est inconnu. */
export const scoreAcquisitionLevel = (
  level: string,
  abbreviation: string
): number | null => {
  const raw = `${level} ${abbreviation}`;
  const text = normalize(raw);
  if (/\btbm\b|tres bonne|excellent|expert|\b4\b/.test(text)) {
    return 4;
  }
  if (
    /\bmi\b|insuffis|non acquis|\bna\b|non atteint|debutant|\b1\b/.test(text)
  ) {
    return 1;
  }
  if (/\beca\b|en cours|fragile|\bmf\b|moyen|partiellement|\b2\b/.test(text)) {
    return 2;
  }
  if (/\bms\b|satisfais|\bacquis\b|\bbien\b|maitrise|\b3\b/.test(text)) {
    return 3;
  }
  return null;
};

const LEVEL_COLORS: Record<number, string> = {
  1: "#DA2400",
  2: "#DD6B00",
  3: "#12BB67",
  4: "#007FDA",
};

/** Couleur du pastille de niveau, repli sur la couleur de la matière. */
export const getAcquisitionColor = (
  level: string,
  abbreviation: string,
  fallback: string
): string => {
  const score = scoreAcquisitionLevel(level, abbreviation);
  if (score === null) {
    return fallback;
  }
  return LEVEL_COLORS[score] ?? fallback;
};
