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
  return {
    subject: course.subject,
    id: course.courseId,
    fromCache: true,
    createdByAccount: course.createdByAccount ?? "",
    type: course.type,
    from: new Date(course.from),
    to: new Date(course.to),
    additionalInfo: course.additionalInfo,
    room: course.room,
    teacher: course.teacher,
    group: course.group,
    backgroundColor: course.backgroundColor,
    status: course.status,
    customStatus: course.customStatus,
    url: course.url,
    kidName: course.kidName,
    resourceId: (course as { resourceId?: unknown }).resourceId as string | undefined,
    content: parseContent((course as { contentRaw?: unknown }).contentRaw),
  }
}
