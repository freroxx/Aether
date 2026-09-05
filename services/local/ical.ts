import { Course as SharedCourse } from '@/services/shared/timetable';
import { useSettingsStore } from '@/stores/settings';
import { getDeviceCalendarEvents } from './android-calendar';

export interface ICalEvent {
  uid: string;
  summary?: string;
  description?: string;
  dtstart?: Date;
  dtend?: Date;
  location?: string;
  allday?: boolean;
  organizer?: string;
}

export interface ParsedICalData {
  events: ICalEvent[];
  calendarName?: string;
  isADE: boolean;
  isHyperplanning: boolean;
  provider?: string;
  url?: string;
  isSchool?: boolean;
  schoolName?: string;
}

export async function fetchAndParseICal(url: string): Promise<ParsedICalData> {
  return {
    events: [],
    calendarName: '',
    isADE: false,
    isHyperplanning: false,
    provider: 'none',
    url,
    isSchool: false,
  };
}

export async function getICalEventsForWeek(weekStart: Date, weekEnd: Date): Promise<SharedCourse[]> {
  try {
    const enabledIds = useSettingsStore.getState().personalization.enabledCalendarIds;
    if (!enabledIds || enabledIds.length === 0) {
      return [];
    }
    return await getDeviceCalendarEvents(enabledIds, weekStart, weekEnd);
  } catch (e) {
    return [];
  }
}

export async function getICalCourseById(id: string): Promise<SharedCourse | undefined> {
  return undefined;
}
