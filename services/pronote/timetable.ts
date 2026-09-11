import { PronoteApiClient } from "@/services/pronote/api-client";
import { AttachmentType } from "@/services/shared/attachment";
import { Course, CourseDay, CourseResource, CourseStatus, CourseType } from "@/services/shared/timetable";
import { getWeekRange, getWeekRangeForDate } from "@/utils/services/periods";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteWeekTimetable(
  authToken: string,
  accountId: string,
  weekNumberRaw: number,
  date: Date,
  childName?: string
): Promise<CourseDay[]> {
  try {
    // La plage est dérivée de `date` (semaine ISO la contenant), PAS de
    // `weekNumberRaw + year` : l'arithmétique week-1/week+1 casse aux
    // frontières d'année (semaine 0/54 -> mauvaise année -> EDT vide).
    let start: Date;
    let end: Date;
    try {
      const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
      ({ start, end } = getWeekRangeForDate(d));
    } catch {
      const year = date ? date.getFullYear() : new Date().getFullYear();
      ({ start, end } = getWeekRange(weekNumberRaw, year));
    }
    const fromStr = start.toISOString().split("T")[0];
    const toStr = end.toISOString().split("T")[0];

    const response = await PronoteApiClient.getTimetable(authToken, fromStr, toStr, childName);
    const dayMap: Record<string, Course[]> = {};

    for (const l of response.lessons || []) {
      const fromDate = new Date(l.start);
      const toDate = new Date(l.end);
      const dayKey = fromDate.toISOString().split("T")[0];

      dayMap[dayKey] = dayMap[dayKey] || [];
      dayMap[dayKey].push({
        id: l.id,
        resourceId: (l as any).resource_id ?? l.id,
        subject: l.subject || "Matière",
        from: fromDate,
        to: toDate,
        room: l.room || "",
        teacher: l.teacher || "",
        group: (l as any).group || "",
        backgroundColor: l.backgroundColor || l.color || undefined,
        status: l.canceled ? CourseStatus.CANCELED : undefined,
        customStatus: l.status || undefined,
        additionalInfo: l.memo || undefined,
        url: Array.isArray((l as any).virtual_classrooms) && (l as any).virtual_classrooms.length > 0
          ? (l as any).virtual_classrooms[0]
          : undefined,
        type: CourseType.LESSON,
        createdByAccount: accountId,
        kidName: childName,
        // L'EDT est volontairement sans contenu (rapide) ; le contenu se
        // charge à la demande via fetchPronoteCourseResources.
        // Si le backend en renvoie quand même (vieux déploiement), on le mappe.
        content: Array.isArray(l.content) && l.content.length > 0 ? l.content.map((c: any): CourseResource => ({
          title: c?.title ?? undefined,
          description: c?.description ?? undefined,
          category: (typeof c?.category === "number" || typeof c?.category === "string") ? c.category : 0,
          attachments: Array.isArray(c?.files) ? c.files.map((f: any) => ({
            type: f?.type === 0 ? AttachmentType.LINK : AttachmentType.FILE,
            name: f?.name ?? "Fichier",
            url: f?.url ?? "",
            createdByAccount: accountId,
          })) : [],
        })).filter((c: CourseResource) => c.title || c.description || (c.attachments?.length ?? 0) > 0) : [],
      });
    }

    for (const day in dayMap) {
      dayMap[day].sort((a, b) => a.from.getTime() - b.from.getTime());
    }

    return Object.entries(dayMap).map(([day, courses]) => ({
      date: new Date(day),
      courses,
    }));
  } catch (err) {
    error(`Failed to fetch timetable: ${err}`, "fetchPronoteWeekTimetable");
    return [];
  }
}

export async function fetchPronoteCourseResources(
  authToken: string,
  course: Course
): Promise<CourseResource[]> {
  try {
    // Si le cache DB a déjà du contenu, on le renvoie (pas de réseau).
    if (Array.isArray(course.content) && course.content.length > 0) {
      return course.content;
    }
    const fromIso = course.from instanceof Date
      ? course.from.toISOString()
      : new Date(course.from).toISOString();
    const dateStr = fromIso.split("T")[0];
    const childName = (course as { kidName?: string }).kidName;
    const resourceId = (course as { resourceId?: string }).resourceId;
    // `course.id` en cache = routeId (hash), pas l'id Pronote (qui tourne
    // à chaque session) : on ne l'envoie que si ça ressemble à un id brut.
    const looksLikeRouteId = typeof course.id === "string" && course.id.length >= 20 && !/^\d+$/.test(course.id);
    const response = await PronoteApiClient.getLessonContent(authToken, {
      lessonId: resourceId && !looksLikeRouteId ? resourceId : (looksLikeRouteId ? undefined : course.id),
      lessonStart: fromIso,
      subject: course.subject,
      date: dateStr,
      child: childName,
    });
    const accountId = course.createdByAccount ?? "";
    const mapped: CourseResource[] = (response.contents || []).map((c: any): CourseResource => ({
      title: c?.title ?? undefined,
      description: c?.description ?? undefined,
      category: (typeof c?.category === "number" || typeof c?.category === "string") ? c.category : 0,
      attachments: Array.isArray(c?.files) ? c.files.map((f: any) => ({
        // pronotepy: 0 = lien externe (ouverture navigateur), 1 = fichier.
        type: f?.type === 0 ? AttachmentType.LINK : AttachmentType.FILE,
        name: f?.name ?? "Fichier",
        url: f?.url ?? "",
        createdByAccount: accountId,
      })) : [],
    })).filter((c: CourseResource) => c.title || c.description || (c.attachments?.length ?? 0) > 0);
    return mapped;
  } catch (err) {
    error(`Failed to fetch course resources: ${err}`, "fetchPronoteCourseResources");
    return Array.isArray(course.content) ? course.content : [];
  }
}