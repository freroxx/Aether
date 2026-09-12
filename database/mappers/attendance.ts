import { Absence, Attendance, Delay, Observation, Punishment } from "@/database/models/Attendance";
import { Absence as SharedAbsence, Delay as SharedDelay, Observation as SharedObservation,Punishment as SharedPunishment } from "@/services/shared/attendance";

export function mapDelaysToShared(delays: Delay[], parent: Attendance): SharedDelay[] {
  return delays.map(delay => ({
    id: (delay as any).id ?? String((delay as any).givenAt ?? ""),
    givenAt: new Date(delay.givenAt),
    reason: delay.reason,
    justified: delay.justified,
    duration: delay.duration,
    justification: (delay as any).justification ?? undefined,
    createdByAccount: parent.createdByAccount,
    kidName: parent.kidName
  }));
}

export function mapAbsencesToShared(absences: Absence[], parent: Attendance): SharedAbsence[] {
  return absences.map(absence => {
    const from = new Date(absence.from);
    const to = new Date(absence.to);
    const diffMins = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
    return {
      id: (absence as any).id ?? String((absence as any).from ?? ""),
      from,
      to,
      reason: absence.reason,
      justified: absence.justified,
      timeMissed: diffMins || 60,
      days: (absence as any).days ?? undefined,
      createdByAccount: parent.createdByAccount,
      kidName: parent.kidName
    };
  });
}

export function mapPunishmentsToShared(punishments: Punishment[]): SharedPunishment[] {
  return punishments.map(punishment => {
    let schedule: SharedPunishment["schedule"];
    try {
      const raw = (punishment as any).scheduleRaw;
      const arr = raw ? JSON.parse(raw) : undefined;
      if (Array.isArray(arr)) {
        schedule = arr.map((s: any) => ({
          id: s?.id ?? null,
          start: s?.start ? new Date(s.start) : null,
          durationMinutes: typeof s?.durationMinutes === "number" ? s.durationMinutes : null,
        }));
      }
    } catch {
      schedule = undefined;
    }
    return {
      id: punishment.id,
      givenAt: new Date(punishment.givenAt),
      givenBy: punishment.givenBy,
      exclusion: punishment.exclusion,
      duringLesson: punishment.duringLesson,
      homework: {
        text: punishment.homeworkText,
        documents: punishment.homeworkDocuments
      },
      reason: {
        text: punishment.reasonText,
        circumstances: punishment.reasonCircumstances,
        documents: punishment.reasonDocuments
      },
      nature: punishment.nature,
      duration: punishment.duration,
      durationMinutes: (punishment as any).durationMinutes ?? punishment.duration,
      schedulable: (punishment as any).schedulable ?? false,
      requiresParent: (punishment as any).requiresParent ?? null,
      schedule,
    };
  });
}

export function mapObservationsToShared(observations: Observation[]): SharedObservation[] {
  return observations.map(observation => ({
    id: observation.id,
    givenAt: new Date(observation.givenAt),
    sectionName: observation.sectionName,
    sectionType: observation.sectionType,
    subjectName: observation.subjectName,
    shouldParentsJustify: observation.shouldParentsJustify,
    reason: observation.reason
  }))
}
