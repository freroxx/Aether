import { PronoteApiClient } from "@/services/pronote/api-client";
import { Absence, Attendance, Delay, Observation, Punishment } from "@/services/shared/attendance";
import { Period } from "@/services/shared/grade";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteAttendance(
  authToken: string,
  accountId: string,
  period: string,
  childName?: string
): Promise<Attendance> {
  try {
    const data = await PronoteApiClient.getAttendance(authToken, childName);

    const absences: Absence[] = (data.absences || []).map((a: any) => {
      const fromDate = new Date(a.from || Date.now());
      const toDate = new Date(a.to || Date.now());
      const diffMins = Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / 60000));
      return {
        id: a.id,
        from: fromDate,
        to: toDate,
        justified: a.justified ?? false,
        reason: a.reason || "",
        timeMissed: diffMins || 60, // default 1 hour if same start/end
        createdByAccount: accountId,
      };
    });

    const delays: Delay[] = (data.delays || []).map((d: any) => ({
      id: d.id,
      givenAt: new Date(d.date || Date.now()),
      duration: d.duration || 0,
      justified: d.justified ?? false,
      reason: d.reason || "",
      createdByAccount: accountId,
    }));

    const punishments: Punishment[] = (data.punishments || []).map((p: any) => ({
      id: p.id,
      givenAt: new Date(p.date || Date.now()),
      givenBy: p.giver || "",
      exclusion: false,
      duringLesson: false,
      homework: { text: "", documents: [] },
      reason: { text: p.reason || "", circumstances: "", documents: [] },
      nature: p.nature || "",
      duration: 0,
    }));

    return {
      absences,
      delays,
      punishments,
      observations: [],
      createdByAccount: accountId,
    };
  } catch (err) {
    error(`Failed to fetch attendance: ${err}`, "fetchPronoteAttendance");
    return {
      absences: [],
      delays: [],
      punishments: [],
      observations: [],
      createdByAccount: accountId,
    };
  }
}

export async function fetchPronoteAttendancePeriods(
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
    error(`Failed to fetch attendance periods: ${err}`, "fetchPronoteAttendancePeriods");
    return [];
  }
}