import { PronoteApiClient } from "@/services/pronote/api-client";
import { Period, Report } from "@/services/shared/grade";
import { error } from "@/utils/logger/logger";

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isNaN(v) ? null : v;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isNaN(n) ? null : n;
}

export async function fetchPronoteReport(
  authToken: string,
  accountId: string,
  period: Period,
  childName?: string
): Promise<Report | null> {
  try {
    const data = await PronoteApiClient.getReport(authToken, period.name, childName);
    const r = data.report;
    if (!r) return null;
    return {
      comments: Array.isArray(r.comments) ? r.comments.map((c: unknown) => String(c)) : [],
      subjects: Array.isArray(r.subjects)
        ? r.subjects.map((s: any) => ({
          id: s.id ?? null,
          name: s.name ?? "",
          color: s.color ?? null,
          comments: Array.isArray(s.comments)
            ? s.comments.map((c: unknown) => String(c))
            : [],
          classAverage: toNumberOrNull(s.class_average),
          studentAverage: toNumberOrNull(s.student_average),
          minAverage: toNumberOrNull(s.min_average),
          maxAverage: toNumberOrNull(s.max_average),
          coefficient: toNumberOrNull(s.coefficient),
          teachers: Array.isArray(s.teachers)
            ? s.teachers.map((t: unknown) => String(t))
            : [],
        }))
        : [],
      createdByAccount: accountId,
    };
  } catch (err) {
    error(`Failed to fetch report: ${err}`, "fetchPronoteReport");
    return null;
  }
}
