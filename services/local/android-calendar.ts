import * as Calendar from 'expo-calendar/legacy';
import { Course, CourseStatus, CourseType } from '@/services/shared/timetable';
import { error, log } from '@/utils/logger/logger';

export interface DeviceCalendarInfo {
  id: string;
  title: string;
  source: string;
  color: string;
  isPrimary?: boolean;
}

export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    if (!Calendar?.requestCalendarPermissionsAsync) {
      return false;
    }
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    error('Error requesting calendar permissions: ' + e);
    return false;
  }
}

export async function hasCalendarPermissions(): Promise<boolean> {
  try {
    if (!Calendar?.getCalendarPermissionsAsync) {
      return false;
    }
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

export async function getDeviceCalendars(): Promise<DeviceCalendarInfo[]> {
  try {
    if (!Calendar?.getCalendarsAsync) {
      return [];
    }
    const granted = await hasCalendarPermissions();
    if (!granted) return [];

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (!calendars || !Array.isArray(calendars)) return [];

    return calendars
      .filter(Boolean)
      .map(cal => ({
        id: String(cal?.id ?? ''),
        title: cal?.title || 'Calendrier',
        source: cal?.source?.name || cal?.source?.type || 'Appareil',
        color: cal?.color || '#3568D4',
        isPrimary: cal?.isPrimary,
      }))
      .filter(cal => cal.id.length > 0);
  } catch (e) {
    error('Error fetching device calendars: ' + e);
    return [];
  }
}

export async function getDeviceCalendarEvents(
  calendarIds: string[],
  startDate: Date,
  endDate: Date
): Promise<Course[]> {
  try {
    if (!calendarIds || !calendarIds.length) return [];

    if (!Calendar?.getEventsAsync || !Calendar?.getCalendarsAsync) {
      return [];
    }
    const granted = await hasCalendarPermissions();
    if (!granted) return [];

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calMap = new Map((calendars || []).map(c => [String(c.id), c]));

    const rawEvents = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
    if (!rawEvents || !Array.isArray(rawEvents)) return [];

    return rawEvents.map(event => {
      const cal = calMap.get(String(event.calendarId));
      const from = new Date(event.startDate);
      const to = new Date(event.endDate);

      return {
        id: `android_cal_${event.id}`,
        subject: event.title || 'Événement',
        teacher: event.notes || cal?.title || 'Calendrier personnel',
        room: event.location || undefined,
        backgroundColor: cal?.color || '#3568D4',
        status: CourseStatus.ONLINE,
        type: CourseType.ACTIVITY,
        from,
        to,
        createdByAccount: 'android_calendar',
      };
    });
  } catch (e) {
    error('Error fetching device calendar events: ' + e);
    return [];
  }
}
