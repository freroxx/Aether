import { Course as SharedCourse, CourseResource } from "@/services/shared/timetable";

import Course from "../models/Timetable";

function parseContent(raw: unknown): CourseResource[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return undefined;
    return parsed as CourseResource[];
  } catch {
    return undefined;
  }
}

export function mapCourseToShared(course: Course): SharedCourse {
  const parseArr = (raw: unknown): string[] | undefined => {
    if (!raw) return undefined;
    try {
      const v = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(v) ? v.map(String) : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    subject: course.subject,
    subjectId: (course as any).subjectId ?? undefined,
    id: course.courseId,
    fromCache: true,
    createdByAccount: course.createdByAccount ?? "",
    type: course.type,
    from: new Date(course.from),
    to: new Date(course.to),
    additionalInfo: course.additionalInfo,
    room: course.room,
    teacher: course.teacher,
    teacherNames: parseArr((course as any).teacherNamesRaw),
    classrooms: parseArr((course as any).classroomsRaw),
    group: course.group,
    groupNames: parseArr((course as any).groupNamesRaw),
    num: (course as any).num ?? undefined,
    detention: (course as any).detention ?? undefined,
    outing: (course as any).outing ?? undefined,
    isTest: (course as any).isTest ?? undefined,
    exempted: (course as any).exempted ?? undefined,
    virtualClassrooms: parseArr((course as any).virtualClassroomsRaw),
    backgroundColor: course.backgroundColor,
    status: course.status,
    customStatus: course.customStatus,
    url: course.url,
    kidName: course.kidName,
    resourceId: (course as { resourceId?: unknown }).resourceId as string | undefined,
    content: parseContent((course as { contentRaw?: unknown }).contentRaw),
  }
}
