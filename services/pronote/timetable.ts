import { PronoteApiClient } from "@/services/pronote/api-client";
import { AttachmentType } from "@/services/shared/attachment";
import { Course, CourseDay, CourseResource, CourseStatus, CourseType, WeekLessonContent } from "@/services/shared/timetable";
import { getWeekRange, getWeekRangeForDate } from "@/utils/services/periods";
import { error } from "@/utils/logger/logger";

/** Heure murale locale "YYYY-MM-DDTHH:mm:ss" (sans offset) : pronotepy expose
 *  des datetimes naïfs en heure de l'établissement, donc on compare mur à mur
 *  (envoyer de l'UTC ".toISOString()" décalait tout de +1/+2h -> contenu jamais
 *  retrouvé en été). */
export function toLocalWallIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Matière normalisée : Pronote renvoie "MATHEMATIQUES" quand l'EDT dit
 *  "Mathématiques" (casse + accents différents). */
export function normSubject(s: unknown): string {
  try {
    return String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function toTimeSafe(v: unknown): number {
  try {
    const t = v instanceof Date ? v.getTime() : new Date(v as any).getTime();
    return Number.isFinite(t) ? t : NaN;
  } catch {
    return NaN;
  }
}

function mapRawContent(c: any, accountId: string): CourseResource | null {
  const mapped: CourseResource = {
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
  };
  return (mapped.title || mapped.description || (mapped.attachments?.length ?? 0) > 0) ? mapped : null;
}

/** Rattache un contenu batché à un cours : même matière (insensible casse,
 *  inclusion) + débuts à moins de 5 min (instants, même référentiel mur). */
export function matchContentForCourse(
  contents: WeekLessonContent[] | undefined,
  course: Pick<Course, "from" | "subject">
): CourseResource[] | null {
  if (!Array.isArray(contents) || contents.length === 0) return null;
  const fromMs = toTimeSafe(course.from);
  if (!Number.isFinite(fromMs)) return null;
  const want = normSubject(course.subject);
  for (const c of contents) {
    if (!c || c.lessonStart === null) continue;
    const startMs = toTimeSafe(c.lessonStart);
    if (!Number.isFinite(startMs)) continue;
    if (Math.abs(startMs - fromMs) > 5 * 60 * 1000) continue;
    const got = normSubject(c.subject);
    if (want && got && (got.includes(want) || want.includes(got))) {
      return c.resources.length > 0 ? c.resources : null;
    }
    // Sans matière fiable des deux côtés, l'heure seule suffit si unique.
    if (!want || !got) {
      return c.resources.length > 0 ? c.resources : null;
    }
  }
  return null;
}

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
      const isDetention = Boolean((l as any).detention ?? (l as any).is_detention ?? false);
      const isOuting = Boolean((l as any).outing ?? (l as any).is_outing ?? false);

      dayMap[dayKey] = dayMap[dayKey] || [];
      dayMap[dayKey].push({
        id: l.id,
        resourceId: (l as any).resource_id ?? l.id,
        subject: l.subject || "Matière",
        subjectId: (l as any).subject_id ?? undefined,
        subjectGroups: Boolean((l as any).subject_groups ?? false),
        from: fromDate,
        to: toDate,
        room: l.room || "",
        teacher: l.teacher || "",
        teacherNames: Array.isArray((l as any).teacher_names) ? (l as any).teacher_names : undefined,
        classrooms: Array.isArray((l as any).classrooms) ? (l as any).classrooms : undefined,
        group: (l as any).group || "",
        groupNames: Array.isArray((l as any).group_names) ? (l as any).group_names : undefined,
        num: typeof (l as any).num === "number" ? (l as any).num : undefined,
        normal: typeof (l as any).normal === "boolean" ? (l as any).normal : (!isDetention && !isOuting),
        detention: isDetention,
        outing: isOuting,
        isTest: Boolean((l as any).test ?? (l as any).is_test ?? false),
        exempted: Boolean((l as any).exempted ?? false),
        virtualClassrooms: Array.isArray((l as any).virtual_classrooms) ? (l as any).virtual_classrooms : undefined,
        backgroundColor: l.backgroundColor || l.color || undefined,
        status: l.canceled ? CourseStatus.CANCELED : undefined,
        customStatus: l.status || undefined,
        additionalInfo: l.memo || undefined,
        url: Array.isArray((l as any).virtual_classrooms) && (l as any).virtual_classrooms.length > 0
          ? (l as any).virtual_classrooms[0]
          : undefined,
        type: isDetention ? CourseType.DETENTION : CourseType.LESSON,
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
    const fromDate = course.from instanceof Date ? course.from : new Date(course.from);
    // Heure murale (pas d'UTC) : cf. toLocalWallIso.
    const fromWall = toLocalWallIso(fromDate);
    const dateStr = fromWall.split("T")[0];
    const childName = (course as { kidName?: string }).kidName;
    const resourceId = (course as { resourceId?: string }).resourceId;
    // `course.id` en cache = routeId (hash), pas l'id Pronote (qui tourne
    // à chaque session) : on ne l'envoie que si ça ressemble à un id brut.
    const looksLikeRouteId = typeof course.id === "string" && course.id.length >= 20 && !/^\d+$/.test(course.id);
    const response = await PronoteApiClient.getLessonContent(authToken, {
      lessonId: resourceId && !looksLikeRouteId ? resourceId : (looksLikeRouteId ? undefined : course.id),
      lessonStart: fromWall,
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

/** Contenus de tous les cours d'une fenêtre en UNE requête (GET
 *  /timetable/contents : 1 PageCahierDeTexte / semaine côté backend).
 *  Remplace N appels POST /timetable/lesson-content (1 login + scan chacun).
 *  Les ids Pronote tournant à chaque session, le rattachement se fait via
 *  matchContentForCourse (heure + matière). */
export async function fetchPronoteWeekContents(
  authToken: string,
  accountId: string,
  from: Date,
  to: Date,
  childName?: string
): Promise<WeekLessonContent[]> {
  try {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const f = from instanceof Date && !isNaN(from.getTime()) ? from : new Date();
    const t = to instanceof Date && !isNaN(to.getTime()) ? to : new Date(f.getTime() + 7 * 86400000);
    const response = await PronoteApiClient.getTimetableContents(authToken, fmt(f), fmt(t), childName);
    const out: WeekLessonContent[] = [];
    for (const c of response.contents || []) {
      let start: Date | null = null;
      try {
        // Heure murale établissement (même référentiel que Course.from).
        const raw = String(c?.lesson_start ?? "");
        const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (m) {
          start = new Date(
            Number(m[1]), Number(m[2]) - 1, Number(m[3]),
            Number(m[4]), Number(m[5]), Number(m[6] ?? "0")
          );
          if (isNaN(start.getTime())) start = null;
        }
      } catch {
        start = null;
      }
      const resources: CourseResource[] = [];
      const one = mapRawContent(c, accountId);
      if (one) resources.push(one);
      if (resources.length === 0) continue;
      out.push({
        lessonId: typeof c?.lesson_id === "string" ? c.lesson_id : undefined,
        lessonStart: start,
        subject: String(c?.subject ?? ""),
        resources,
      });
    }
    return out;
  } catch (err) {
    error(`Failed to fetch week contents: ${err}`, "fetchPronoteWeekContents");
    return [];
  }
}