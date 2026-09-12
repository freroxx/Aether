import { t } from "i18next";

export type GradeStatusCode =
  | "Absent"
  | "Dispense"
  | "NonNote"
  | "Inapte"
  | "NonRendu"
  | "AbsentZero"
  | "NonRenduZero"
  | "Felicitations";

export interface GradeStatusMeta {
  code: GradeStatusCode;
  label: string;
  /** Calm distinct color for subtle pill/caption. */
  color: string;
}

/**
 * Normalise un status backend Pronote vers un code connu.
 * Accepte status_code ("Absent", "NonNote"...), raw_grade ("|1".." |8",
 * "Abs", "Disp.", "Non rendu"...), ou un vieux libellé ("Abs/Non noté").
 * Retourne null si rien d'exploitable.
 */
export function normalizeGradeStatus(input?: string | null): GradeStatusCode | null {
  if (!input || typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  // "|1".."|8" (pronotepy Util.grade_translate)
  const pipeMatch = raw.match(/\|?\s*([1-8])\s*$/);
  // Éviter de confondre une vraie note "18" avec "|8" : seulement si pipe ou chaîne courte.
  if (raw.includes("|") && pipeMatch) {
    const n = pipeMatch[1];
    switch (n) {
      case "1": return "Absent";
      case "2": return "Dispense";
      case "3": return "NonNote";
      case "4": return "Inapte";
      case "5": return "NonRendu";
      case "6": return "AbsentZero";
      case "7": return "NonRenduZero";
      case "8": return "Felicitations";
    }
  }

  const norm = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  if (!norm) return null;

  // Zéros d'abord (contiennent "absent"/"nonrendu" + zéro)
  if (norm.includes("absent") && (norm.includes("zero") || norm.includes("0") || norm.includes("z"))) {
    return "AbsentZero";
  }
  if (
    (norm.includes("nonrendu") || norm === "nr0" || norm === "nr") &&
    (norm.includes("zero") || norm.includes("0") || norm.endsWith("z"))
  ) {
    return "NonRenduZero";
  }
  // Abréviations zéro explicites
  if (norm === "abs0" || norm === "absz" || norm === "absentz") return "AbsentZero";
  if (norm === "nr0" || norm === "nrz" || norm === "nonrenduz") return "NonRenduZero";

  if (norm.includes("felicit")) return "Felicitations";
  if (norm.includes("inapte") || norm === "inap") return "Inapte";
  if (norm.includes("dispense") || norm === "disp" || norm === "d") return "Dispense";
  if (norm.includes("absent") || norm === "abs" || norm === "a") return "Absent";
  if (
    norm.includes("nonrendu") ||
    norm === "nr" ||
    (norm.includes("non") && norm.includes("rendu"))
  ) {
    return "NonRendu";
  }
  if (
    norm.includes("nonnote") ||
    (norm.includes("non") && norm.includes("note")) ||
    norm === "nn" ||
    norm === "nnote" ||
    // Legacy générique "Abs/Non noté" -> Non noté
    norm === "absnonnote"
  ) {
    return "NonNote";
  }

  return null;
}

/** Résout le status à afficher depuis un grade (statusCode/raw/status). */
export function resolveGradeStatusCode(
  statusCode?: string | null,
  rawGrade?: string | null,
  status?: string | null
): GradeStatusCode | null {
  return (
    normalizeGradeStatus(statusCode) ??
    normalizeGradeStatus(rawGrade) ??
    normalizeGradeStatus(status)
  );
}

const STATUS_COLORS: Record<GradeStatusCode, string> = {
  Absent: "#C2410C",
  Dispense: "#6B7280",
  NonNote: "#78716C",
  Inapte: "#7C3AED",
  NonRendu: "#B45309",
  AbsentZero: "#B91C1C",
  NonRenduZero: "#92400E",
  Felicitations: "#15803D",
};

export function getGradeStatusColor(code: GradeStatusCode | null): string {
  if (!code) return "#6B7280";
  return STATUS_COLORS[code] ?? "#6B7280";
}

/** Libellé FR localisé (t avec fallback FR pour rester calme hors-locale). */
export function getGradeStatusLabel(
  code: GradeStatusCode | null,
  fallback?: string | null
): string {
  switch (code) {
    case "Absent":
      return t("Grade_Status_Absent", "Absent");
    case "Dispense":
      return t("Grade_Status_Dispense", "Dispensé");
    case "NonNote":
      return t("Grade_Status_NonNote", "Non noté");
    case "Inapte":
      return t("Grade_Status_Inapte", "Inapte");
    case "NonRendu":
      return t("Grade_Status_NonRendu", "Non rendu");
    case "AbsentZero":
      return t("Grade_Status_AbsentZero", "Absent (0)");
    case "NonRenduZero":
      return t("Grade_Status_NonRenduZero", "Non rendu (0)");
    case "Felicitations":
      return t("Grade_Status_Felicitations", "Félicitations");
    default:
      if (fallback && String(fallback).trim()) return String(fallback).trim();
      return t("Grade_Status_Unknown", "Non noté");
  }
}

export function getGradeStatusMeta(
  statusCode?: string | null,
  rawGrade?: string | null,
  status?: string | null
): GradeStatusMeta | null {
  const code = resolveGradeStatusCode(statusCode, rawGrade, status);
  if (!code) {
    if (status && String(status).trim()) {
      return {
        code: "NonNote",
        label: String(status).trim(),
        color: getGradeStatusColor(null),
      };
    }
    return null;
  }
  return {
    code,
    label: getGradeStatusLabel(code, status),
    color: getGradeStatusColor(code),
  };
}

/** True si le status compte comme 0 dans la moyenne (Pronote). */
export function isZeroCountedStatus(code: GradeStatusCode | null): boolean {
  return code === "AbsentZero" || code === "NonRenduZero";
}
