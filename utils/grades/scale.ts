export type GradeDisplayScale = "20" | "10" | "5" | "percentage";

export const DEFAULT_GRADE_DISPLAY_SCALE: GradeDisplayScale = "20";

export const getGradeDisplayScale = (
  value?: string,
): GradeDisplayScale => {
  if (value === "10" || value === "5" || value === "percentage" || value === "20") {
    return value;
  }

  return DEFAULT_GRADE_DISPLAY_SCALE;
};

export const getDisplayScaleMax = (scale: GradeDisplayScale): number => {
  if (scale === "percentage") {
    return 100;
  }

  return Number(scale);
};

export const toDisplayScaleFrom20 = (value: number, scale: GradeDisplayScale): number => {
  if (scale === "percentage") {
    return (value / 20) * 100;
  }

  return (value / 20) * Number(scale);
};

export const getDisplayDenominator = (scale: GradeDisplayScale): string => {
  if (scale === "percentage") {
    return "%";
  }

  return `/${scale}`;
};

function normalizeOutOf(outOf: unknown): number | null {
  let v: unknown = outOf;
  if (typeof v === "object" && v !== null && "value" in (v as Record<string, unknown>)) {
    v = (v as Record<string, unknown>).value;
  }
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

export function formatDenominator(outOf: unknown, fallback = 20): string {
  const n = normalizeOutOf(outOf);
  if (n !== null) return `/${n}`;
  const f = typeof fallback === "number" && Number.isFinite(fallback) && fallback > 0 ? fallback : 20;
  return `/${f}`;
}

export function formatDenominatorForScale(scale: unknown): string {
  if (scale === "percentage") {
    return "%";
  }
  if (scale === "20" || scale === "10" || scale === "5") {
    return `/${scale}`;
  }
  return "/20";
}

export const formatAssumed20ForDisplay = (
  value: number,
  scale: GradeDisplayScale,
): { value: number; denominator: string } => {
  return {
    value: toDisplayScaleFrom20(value, scale),
    denominator: getDisplayDenominator(scale),
  };
};

export const formatScoreForDisplay = (
  value: number,
  outOf: unknown,
  scale: GradeDisplayScale,
): { value: number; denominator: string } => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeOutOf = normalizeOutOf(outOf) ?? 20;
  if (safeOutOf === 20) {
    return formatAssumed20ForDisplay(safeValue, scale);
  }

  return {
    value: safeValue,
    denominator: formatDenominator(safeOutOf),
  };
};
