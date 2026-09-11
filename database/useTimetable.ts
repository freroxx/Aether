import { Model, Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

import { getICalCourseById, getICalEventsForWeek } from "@/services/local/ical";
import { Course as SharedCourse,CourseDay as SharedCourseDay } from "@/services/shared/timetable"
import { generateId } from "@/utils/generateId";
import { warn } from "@/utils/logger/logger";

import { getDatabaseInstance, useDatabase } from "./DatabaseProvider"
import { mapCourseToShared } from "./mappers/course";
import Course from "./models/Timetable";
import { safeWrite } from "./utils/safeTransaction";
import { getISOWeekYear, getWeekRange } from "@/utils/services/periods";

function isoYearOf(d: Date): number {
  try {
    return getISOWeekYear(d).year;
  } catch {
    return d.getFullYear();
  }
}

export function getCourseRouteId(course: SharedCourse): string {
  try {
    const owner = typeof course?.createdByAccount === "string" ? course.createdByAccount : "";
    if (owner.startsWith('ical_') || owner === 'android_calendar' || owner.startsWith('calendar_')) {
      return `device_${owner}_${String(course?.id ?? "")}`;
    }
    const from = course?.from instanceof Date ? course.from.toISOString() : new Date(course?.from).toISOString();
    const to = course?.to instanceof Date ? course.to.toISOString() : new Date(course?.to).toISOString();
    const kid = typeof (course as any)?.kidName === "string" ? (course as any).kidName : "";
    return generateId(
      from + to + (course?.subject ?? "") + (course?.teacher ?? "") + (course?.room ?? "") + kid + owner
    );
  } catch {
    return generateId(
      String(course?.id ?? "") + String(course?.subject ?? "") + String(course?.createdByAccount ?? "")
    );
  }
}

export async function getCourseById(id: string): Promise<SharedCourse | undefined> {
  try {
    const courses = await getDatabaseInstance()
      .get<Course>('courses')
      .query(Q.where('courseId', id))
      .fetch();
    return courses[0] ? mapCourseToShared(courses[0]) : await getICalCourseById(id);
  } catch {
    return getICalCourseById(id);
  }
}

export function useTimetable(refresh = 0, weekNumber: number | number[] = 0, date: Date = new Date()) {
  const database = useDatabase();
  const [timetable, setTimetable] = useState<SharedCourseDay[]>([]);

  const weeks = Array.isArray(weekNumber) ? weekNumber : [weekNumber];
  // Create a stable key for the weeks array to use in dependency arrays
  const weeksKey = weeks.join(',');
  const isoYear = isoYearOf(date);

  useEffect(() => {
    const fetchTimetable = async () => {
      const timetableFetched = await getCoursesFromCache(weeks, isoYearOf(date));
      setTimetable(timetableFetched);
    };
    fetchTimetable();
  }, [refresh, database, weeksKey, isoYear]);

  useEffect(() => {
    const icalQuery = database.get('icals').query();
    const subscription = icalQuery.observe().subscribe(() => {
      const fetchTimetable = async () => {
        const timetableFetched = await getCoursesFromCache(weeks, isoYearOf(date));
        setTimetable(timetableFetched);
      };
      fetchTimetable();
    });
    return () => subscription.unsubscribe();
  }, [database, weeksKey, isoYear]);

  return timetable;
}

export async function addCourseDayToDatabase(courses: SharedCourseDay[]) {
  const db = getDatabaseInstance();
  await safeWrite(
    db,
    async () => {
      for (const day of courses) {
        const dayTimestamp = day.date.getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        const dbCourses = await db.get<Course>('courses')
          .query(
            Q.where('from', Q.between(dayTimestamp, dayTimestamp + oneDayMs))
          )
          .fetch();

        const courseKey = (c: SharedCourseDay["courses"][number]) =>
          `${c.createdByAccount}::${(c as any)?.kidName ?? ""}`;
        const dayCourseIds = new Set(
          day.courses.map(course => {
            const kid = (course as any)?.kidName ?? "";
            const oldId = generateId(course.from.toISOString() + course.to.toISOString() + course.subject + course.teacher + course.room + course.createdByAccount);
            const midId = generateId(course.from.toISOString() + course.to.toISOString() + course.subject + course.teacher + course.createdByAccount);
            const newId = getCourseRouteId(course as SharedCourse);
            void kid;
            return [oldId, midId, newId];
          }).flat()
        );
        const refreshedKeys = new Set(day.courses.map(courseKey));

        const coursesToDelete = dbCourses.filter(
          dbCourse =>
            refreshedKeys.has(`${dbCourse.createdByAccount}::${(dbCourse as any)?.kidName ?? ""}`) &&
            !dayCourseIds.has(dbCourse.courseId)
        );

        if (coursesToDelete.length > 0) {
          await Promise.all(coursesToDelete.map(course => course.markAsDeleted()));
        }

        for (const item of day.courses) {
          // MIGRATION TO AVOID DUPES, DO NOT DELETE
          const oldId = generateId(item.from.toISOString() + item.to.toISOString() + item.subject + item.teacher + item.room + item.createdByAccount);
          const id = getCourseRouteId(item);

          const oldExistingRecords = await db.get('courses')
            .query(Q.where('courseId', oldId))
            .fetch();
          const existingRecords = await db.get('courses')
            .query(Q.where('courseId', id))
            .fetch();

          if (oldId !== id && oldExistingRecords.length > 0) {
            await Promise.all(oldExistingRecords.map(oldRecord => oldRecord.markAsDeleted()));
          }

          if (existingRecords.length > 1) {
            // Doublons historiques sur le même courseId -> on ne garde que le 1er.
            await Promise.all(existingRecords.slice(1).map(r => r.markAsDeleted()));
          }

          if (existingRecords.length === 0) {
            await db.get('courses').create((record: Model) => {
              const course = record as Course;
              Object.assign(course, {
                createdByAccount: item.createdByAccount,
                courseId: id,
                subject: item.subject,
                type: item.type,
                from: item.from.getTime(),
                to: item.to.getTime(),
                additionalInfo: item.additionalInfo,
                room: item.room,
                teacher: item.teacher,
                group: item.group,
                backgroundColor: item.backgroundColor,
                status: item.status,
                customStatus: item.customStatus,
                url: item.url,
                kidName: item.kidName,
                resourceId: (item as { resourceId?: string }).resourceId,
                contentRaw: item.content && item.content.length > 0 ? JSON.stringify(item.content) : undefined,
              });
            });
          } else {
            const courseToUpdate = existingRecords[0];
            await courseToUpdate.update((model: Model) => {
              const course = model as Course;
              Object.assign(course, {
                subject: item.subject ?? course.subject,
                type: item.type ?? course.type,
                from: item.from.getTime(),
                to: item.to.getTime(),
                additionalInfo: item.additionalInfo ?? course.additionalInfo,
                room: item.room ?? course.room,
                teacher: item.teacher ?? course.teacher,
                group: item.group ?? course.group,
                backgroundColor: item.backgroundColor ?? course.backgroundColor,
                status: item.status ?? course.status,
                customStatus: item.customStatus ?? course.customStatus,
                url: item.url ?? course.url,
                kidName: item.kidName ?? course.kidName,
                resourceId: (item as { resourceId?: string }).resourceId ?? (course as unknown as { resourceId?: string }).resourceId,
                // Ne jamais écraser un contenu existant par un EDT vide :
                // l'EDT rapide renvoie content: [] volontairement.
                contentRaw: item.content && item.content.length > 0 ? JSON.stringify(item.content) : course.contentRaw,
              });
            });
          }
        }
      }
    },
    15000,
    `add_timetable_${courses.length}_days`
  );
}

export async function getCoursesFromCache(weeks: number[], year: number): Promise<SharedCourseDay[]> {
  try {
    const database = getDatabaseInstance();
    
    let minStart = new Date(8640000000000000);
    let maxEnd = new Date(-8640000000000000);
    
    for (const w of weeks) {
      const { start, end } = getWeekRange(w, year);
      if (start < minStart) {minStart = start;}
      if (end > maxEnd) {maxEnd = end;}
    }

    const courses = await database
      .get<Course>('courses')
      .query(Q.where('from', Q.between(minStart.getTime(), maxEnd.getTime())))
      .fetch();

    const localDayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayMap: Record<string, SharedCourse[]> = {};
    const seenKeys = new Set<string>();
    // Clé canonique partout (DB + hooks) : sans owner, avec teacher + kid.
    const cacheKey = (c: SharedCourse) =>
      `${new Date(c.from).getTime()}::${new Date(c.to).getTime()}::${c.subject}::${(c as any)?.room ?? ""}::${(c as any)?.teacher ?? ""}::${(c as any)?.kidName ?? ""}`;
    for (const course of courses) {
      const shared = mapCourseToShared(course);
      const k = cacheKey(shared);
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      const dayKey = localDayKey(new Date(course.from));
      dayMap[dayKey] = dayMap[dayKey] || [];
      dayMap[dayKey].push(shared);
    }

    try {
      const icalEvents = await getICalEventsForWeek(minStart, maxEnd);
      for (const event of icalEvents) {
        const k = cacheKey(event);
        if (seenKeys.has(k)) continue;
        seenKeys.add(k);
        const dayKey = localDayKey(new Date(event.from));
        dayMap[dayKey] = dayMap[dayKey] || [];
        dayMap[dayKey].push(event);
      }
    } catch (icalError) {
      console.warn('Error loading iCal events:', icalError);
    }

    for (const day in dayMap) {
      dayMap[day].sort((a, b) => a.from.getTime() - b.from.getTime());
    }

    return Object.entries(dayMap)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([day, courses]) => ({
        date: new Date(day + "T00:00:00"),
        courses
      }));
  } catch (e) {
    warn(String(e));
    return [];
  }
}
