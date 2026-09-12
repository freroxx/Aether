import { PronoteApiClient } from "@/services/pronote/api-client";
import { AttachmentType } from "@/services/shared/attachment";
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
      const daysRaw = a.days;
      const days =
        typeof daysRaw === "number"
          ? daysRaw
          : Number.parseInt(String(daysRaw ?? "0"), 10);
      return {
        id: a.id,
        from: fromDate,
        to: toDate,
        justified: a.justified ?? false,
        reason: a.reason || "",
        timeMissed: diffMins || 60, // default 1 hour if same start/end
        days: Number.isNaN(days) ? 0 : days,
        createdByAccount: accountId,
      };
    });

    const delays: Delay[] = (data.delays || []).map((d: any) => ({
      id: d.id,
      givenAt: new Date(d.date || Date.now()),
      duration: typeof d.duration === "number" ? d.duration : Number(d.duration) || 0,
      justified: d.justified ?? false,
      reason: d.reason || "",
      justification: d.justification ?? "",
      createdByAccount: accountId,
    }));

    const punishments: Punishment[] = (data.punishments || []).map((p: any) => {
      const durationRaw = p.duration_minutes ?? p.duration ?? 0;
      const durationMinutes =
        typeof durationRaw === "number" ? durationRaw : Number(durationRaw) || 0;
      const mapDocs = (arr: any) => Array.isArray(arr) ? arr.map((f: any) => ({
        type: f?.type === 0 ? AttachmentType.LINK : AttachmentType.FILE,
        name: f?.name ?? "Fichier",
        url: f?.url ?? "",
        createdByAccount: accountId,
      })) : [];
      return {
        id: p.id,
        givenAt: new Date(p.date || Date.now()),
        givenBy: p.giver || "",
        exclusion: Boolean(p.exclusion ?? false),
        duringLesson: Boolean(p.during_lesson ?? false),
        homework: { text: p.homework ?? "", documents: mapDocs(p.homework_documents) },
        reason: { text: p.reason || "", circumstances: p.circumstances ?? "", documents: mapDocs(p.circumstance_documents) },
        reasons: Array.isArray(p.reasons) ? p.reasons : undefined,
        nature: p.nature || "",
        duration: durationMinutes,
        durationMinutes,
        schedulable: Boolean(p.schedulable ?? false),
        requiresParent: p.requires_parent ?? null,
        schedule: Array.isArray(p.schedule) ? p.schedule.map((s: any) => ({
          id: s?.id ?? null,
          start: s?.start ? new Date(s.start) : null,
          durationMinutes: typeof s?.duration_minutes === "number" ? s.duration_minutes : null,
        })) : undefined,
      };
    });

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