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

// Single shared week-range helper — identical math to the former
// database/useHomework getDateRangeOfWeek. Callers must pass an explicit
// year derived from the relevant date (no hidden default).
export function getWeekRange(
  weekNumber: number,
  year: number
): { start: Date; end: Date } {
  const janFirst = new Date(year, 0, 1);
  const daysOffset = (weekNumber - 1) * 7;
  const weekStart = new Date(janFirst.setDate(janFirst.getDate() + daysOffset));
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day <= 4 ? 1 : 8);
  const start = new Date(weekStart.setDate(diff));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}