import { PronoteApiClient } from "@/services/pronote/api-client";
import { Evaluation, Period } from "@/services/shared/grade";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteEvaluations(
  authToken: string,
  accountId: string,
  period: Period,
  childName?: string
): Promise<Evaluation[]> {
  try {
    const data = await PronoteApiClient.getEvaluations(authToken, period.name, childName);
    return (data.evaluations || []).map((e: any) => ({
      id: String(e.id ?? `${e.name ?? ""}_${e.date ?? ""}`),
      name: e.name ?? "",
      subject: e.subject ?? "",
      teacher: e.teacher ?? "",
      coefficient: typeof e.coefficient === "number" ? e.coefficient : Number(e.coefficient) || 1,
      description: e.description ?? "",
      date: e.date ? new Date(e.date) : undefined,
      paliers: Array.isArray(e.paliers) ? e.paliers.map((p: unknown) => String(p)) : [],
      acquisitions: Array.isArray(e.acquisitions)
        ? e.acquisitions.map((a: any) => ({
          name: a.name ?? "",
          abbreviation: a.abbreviation ?? "",
          level: a.level ?? "",
          coefficient:
            typeof a.coefficient === "number" ? a.coefficient : Number(a.coefficient) || 1,
          domain: a.domain ?? "",
          pillar: a.pillar ?? "",
        }))
        : [],
      createdByAccount: accountId,
    }));
  } catch (err) {
    error(`Failed to fetch evaluations: ${err}`, "fetchPronoteEvaluations");
    return [];
  }
}
