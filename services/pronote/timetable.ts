import { PronoteApiClient } from "@/services/pronote/api-client";
import { Course, CourseDay, CourseResource, CourseStatus, CourseType } from "@/services/shared/timetable";
import { getDateRangeOfWeek } from "@/database/useHomework";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteWeekTimetable(
  authToken: string,
  accountId: string,
  weekNumberRaw: number,
  date: Date,
  childName?: string
): Promise<CourseDay[]> {
  try {
    const year = date ? date.getFullYear() : new Date().getFullYear();
    const { start, end } = getDateRangeOfWeek(weekNumberRaw, year);
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
        subject: l.subject || "Matière",
        from: fromDate,
        to: toDate,
        room: l.room || "",
        teacher: l.teacher || "",
        backgroundColor: l.color || undefined,
        status: l.canceled ? CourseStatus.CANCELED : undefined,
        customStatus: l.status || undefined,
        type: CourseType.LESSON,
        createdByAccount: accountId,
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
  return [];
}