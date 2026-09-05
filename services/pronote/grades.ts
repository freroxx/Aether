import { PronoteApiClient } from "@/services/pronote/api-client";
import { Grade, GradeScore, Period, PeriodGrades, Subject } from "@/services/shared/grade";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteGrades(
  authToken: string,
  accountId: string,
  period: Period,
  childName?: string
): Promise<PeriodGrades> {
  try {
    const data = await PronoteApiClient.getGrades(authToken, period.name, childName);
    const subjectsMap: Record<string, Subject> = {};

    for (const g of data.grades || []) {
      const subjectName = g.subject || "Matière";
      const subjectId = subjectName.toLowerCase().replace(/\s+/g, "_");

      if (!subjectsMap[subjectId]) {
        subjectsMap[subjectId] = {
          id: subjectId,
          name: subjectName,
          classAverage: { value: 0 },
          outOf: { value: 20 },
          grades: [],
        };
      }

      const mappedGrade: Grade = {
        id: g.id,
        subjectId,
        subjectName,
        description: g.description || "",
        givenAt: new Date(g.date),
        outOf: g.out_of !== undefined ? { value: g.out_of } : { value: 20 },
        coefficient: g.coefficient || 1,
        studentScore: g.value !== null && g.value !== undefined ? { value: g.value } : { value: 0, disabled: true, status: "Abs/Non noté" },
        averageScore: g.average !== null && g.average !== undefined ? { value: g.average } : undefined,
        maxScore: g.max !== null && g.max !== undefined ? { value: g.max } : undefined,
        minScore: g.min !== null && g.min !== undefined ? { value: g.min } : undefined,
        createdByAccount: accountId,
      };

      subjectsMap[subjectId].grades?.push(mappedGrade);
    }

    const subjects = Object.values(subjectsMap);

    return {
      studentOverall: { value: data.averages?.overall ?? 0 },
      classAverage: { value: data.averages?.class_overall ?? 0 },
      subjects,
      createdByAccount: accountId,
    };
  } catch (err) {
    error(`Failed to fetch grades: ${err}`, "fetchPronoteGrades");
    return {
      studentOverall: { value: 0 },
      classAverage: { value: 0 },
      subjects: [],
      createdByAccount: accountId,
    };
  }
}

export async function fetchPronoteGradePeriods(
  authToken: string,
  accountId: string,
  childName?: string
): Promise<Period[]> {
  try {
    const data = await PronoteApiClient.getGradePeriods(authToken, childName);
    return (data.periods || []).map((p: any) => ({
      id: p.id || p.name,
      name: p.name,
      start: p.start ? new Date(p.start) : new Date(),
      end: p.end ? new Date(p.end) : new Date(),
      createdByAccount: accountId,
    }));
  } catch (err) {
    error(`Failed to fetch grade periods: ${err}`, "fetchPronoteGradePeriods");
    return [];
  }
}