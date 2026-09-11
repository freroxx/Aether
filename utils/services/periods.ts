import { t } from "i18next";


export const getPeriodName = (name: string) => {
  // Clean up the string: remove digits and trim
  // Remove common prefixes that might be leftover (like "er" from "1er") 
  let newName = name.replace(/^\d{1,4}[a-zÀ-ù]{0,4}/, '').replace(/\d/g, '').trim();

  // Remove digits
  newName = newName.replace(/\d/g, '').trim();

  switch (newName.toLowerCase()) {
    case "trimestre":
      return t("Grades_Trimester");
    case "semestre":
      return t("Grades_Semester");
    case "hors période":
      return t("Grades_OutPeriod");
    case "bac blanc":
      return t("Grades_MockExamBac");
    case "brevet blanc":
      return t("Grades_MockExamBrevet");
    case "année":
      return t("Grades_Year");
    default:
      return newName;
  }
}

export const isPeriodWithNumber = (name: string) => {
  // return only digits
  let newName = name.replace(/\D/g, '').trim();

  return newName.length > 0;
}

export const getPeriodNumber = (name: string) => {
  // return only digits
  let newName = name.replace(/\D/g, '').trim();

  if (newName.length === 0) {
    newName = name[0].toUpperCase();
  }

  return newName.toString()[0];
}

// ISO 8601 : semaine lundi-dimanche, semaine 1 = celle du premier jeudi
// (== celle contenant le 4 janvier). `getWeekNumberFromDate` historique
// (dimanche-start, Jan1-based) divergeait de `getWeekRange` (lundi-start)
// -> tous les dimanches tombaient dans la mauvaise semaine (EDT vide le
// week-end, LessonContent vide, etc.). Les deux helpers ci-dessous partagent
// désormais la même définition ISO, année ISO incluse (29-31 déc / 1-3 jan
// peuvent appartenir à l'année voisine).
export function getISOWeekYear(dateInput: Date): { week: number; year: number } {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // lundi=0..dimanche=6
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  // Jeudi de la semaine courante -> année ISO.
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const isoYear = thursday.getFullYear();
  const week1Monday = mondayOfISOWeek1(isoYear);
  const diffDays = Math.round((monday.getTime() - week1Monday.getTime()) / (24 * 3600 * 1000));
  return { week: 1 + Math.round(diffDays / 7), year: isoYear };
}

export function getWeekNumberFromDateISO(date: Date): number {
  return getISOWeekYear(date).week;
}

// Plage lundi 00:00 -> dimanche 23:59:59.999 pour une semaine ISO.
// Gère les semaines 0/54 (débordement d'année) en les normalisant.
export function getWeekRange(
  weekNumber: number,
  year: number
): { start: Date; end: Date } {
  let w = Math.round(weekNumber);
  let y = Math.round(year);
  if (!Number.isFinite(w) || !Number.isFinite(y)) {
    const now = new Date();
    const iso = getISOWeekYear(now);
    w = iso.week;
    y = iso.year;
  }
  // Normalise les débordements (semaine 0 = dernière semaine année-1, etc.)
  while (w < 1) {
    y -= 1;
    w += weeksInISOYear(y);
  }
  while (w > weeksInISOYear(y)) {
    w -= weeksInISOYear(y);
    y += 1;
  }
  const week1Monday = mondayOfISOWeek1(y);
  const start = new Date(week1Monday);
  start.setDate(week1Monday.getDate() + (w - 1) * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function weeksInISOYear(year: number): number {
  // Une année ISO a 53 semaines si le 1er janvier est un jeudi,
  // ou si c'est une année bissextile commençant un mercredi.
  const jan1 = new Date(year, 0, 1);
  const jan1Day = (jan1.getDay() + 6) % 7; // lundi=0
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (jan1Day === 3) return 53;
  if (isLeap && jan1Day === 2) return 53;
  return 52;
}

function mondayOfISOWeek1(year: number): Date {
  const jan4 = new Date(year, 0, 4);
  const day = (jan4.getDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Plage de la semaine ISO contenant `date` (lundi-dimanche). */
export function getWeekRangeForDate(date: Date): { start: Date; end: Date } {
  const { week, year } = getISOWeekYear(date);
  return getWeekRange(week, year);
}

/**
 * Année ISO la plus probable pour un numéro de semaine seul (sans date).
 * Choisit parmi année-1/année/année+1 celle dont le lundi est le plus proche
 * de `reference` (défaut : aujourd'hui). Évite le piège "semaine 1 en
 * décembre -> mauvaise année" des anciens appels `getWeekRange(w, currentYear).
 */
export function inferYearForWeek(weekNumber: number, reference: Date = new Date()): number {
  const w = Math.round(weekNumber);
  const refYear = reference.getFullYear();
  let best = refYear;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const y of [refYear - 1, refYear, refYear + 1]) {
    try {
      const { start } = getWeekRange(w, y);
      const dist = Math.abs(start.getTime() - reference.getTime());
      if (dist < bestDist) {
        bestDist = dist;
        best = y;
      }
    } catch {
      continue;
    }
  }
  return best;
}

/** Plage pour un numéro de semaine seul : année inférée (proximité). */
export function getWeekRangeForWeekNumber(weekNumber: number, reference: Date = new Date()): { start: Date; end: Date } {
  return getWeekRange(weekNumber, inferYearForWeek(weekNumber, reference));
}