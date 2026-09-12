import type { MockData } from "@/services/mock";
import { Pronote } from "@/services/pronote";
import { Attendance } from "@/services/shared/attendance";
import type { TeachingStaff } from "@/services/shared/staff";
import {
  Booking,
  BookingDay,
  CanteenHistoryItem,
  CanteenKind,
  CanteenMenu,
  QRCode,
} from "@/services/shared/canteen";
import { Chat, Message, Recipient } from "@/services/shared/chat";
import { Period, PeriodGrades, Report, Evaluation } from "@/services/shared/grade";
import { Homework } from "@/services/shared/homework";
import { News } from "@/services/shared/news";
import { Course, CourseDay, CourseResource, WeekLessonContent } from "@/services/shared/timetable";
import { Auth, Services } from "@/stores/account/types";

import { Balance } from "./balance";
import { Kid } from "./kid";

/** Represents a plugin for a school service.
 *
 * @property {string} displayName - The name of the service displayed to the user.
 * @property {Services} service - The identifier for the service.
 * @property {function} refreshAccount - Function used to refresh the account credentials.
 */
export interface SchoolServicePlugin {
  displayName: string;
  service: Services;
  capabilities: Capabilities[];
  authData: Auth;
  requiresInternet?: boolean;
  session: any;

  refreshAccount: (
    credentials: Auth
  ) => Promise<Pronote | MockData>;
  getKids?: () => Kid[];
  getCanteenKind?: () => CanteenKind;
  getHomeworks?: (weekNumber: number) => Promise<Homework[]>;
  getNews?: (opts?: { onlyUnread?: boolean }) => Promise<News[]>;
  getGradesForPeriod?: (period: Period, kid?: Kid) => Promise<PeriodGrades>;
  getGradesPeriods?: () => Promise<Period[]>;
  getEvaluationsForPeriod?: (period: Period, kid?: Kid) => Promise<Evaluation[]>;
  getReportForPeriod?: (period: Period, kid?: Kid) => Promise<Report | null>;
  getTeachingStaff?: (kid?: Kid) => Promise<TeachingStaff[]>;
  getAttendanceForPeriod?: (period: string) => Promise<Attendance>;
  getAttendancePeriods?: () => Promise<Period[]>;
  getWeeklyCanteenMenu?: (startDate: Date) => Promise<CanteenMenu[]>;
  getChats?: (onlyUnread?: boolean) => Promise<Chat[]>;
  getChatRecipients?: (chat: Chat) => Promise<Recipient[]>;
  getChatMessages?: (chat: Chat) => Promise<Message[]>;
  getRecipientsAvailableForNewChat?: () => Promise<Recipient[]>;
  getCourseResources?: (course: Course) => Promise<CourseResource[]>;
  getWeekContents?: (from: Date, to: Date) => Promise<WeekLessonContent[]>;
  getWeeklyTimetable?: (weekNumber: number, date: Date, kidName?: string) => Promise<CourseDay[]>;
  getTimetablePdf?: (day?: Date, portrait?: boolean, overflow?: number) => Promise<string | null>;
  getProfile?: (kid?: Kid) => Promise<import("./profile").StudentProfile | null>;
  getProfilePicture?: (kid?: Kid) => Promise<{ picture: string | null; mime?: string } | null>;
  requestQrCode?: (pin: string, kid?: Kid) => Promise<{ qr: any }>;
  getSessionInfo?: (kid?: Kid) => Promise<{ start_day: string; week: number; logged_in: boolean; last_connection: string | null }>;
  getCurrentPeriod?: (kid?: Kid) => Promise<Period | null>;
  getChatParticipants?: (chat: Chat) => Promise<string[]>;
  markChatAsRead?: (chat: Chat, read?: boolean) => Promise<void>;
  deleteChat?: (chat: Chat) => Promise<void>;
  sendMessageInChat?: (chat: Chat, content: string, messageId?: string) => Promise<void>;
  setNewsAsAcknowledged?: (news: News) => Promise<News>;
  setHomeworkCompletion?: (
    homework: Homework,
    state?: boolean
  ) => Promise<Homework>;
  createMail?: (
    subject: string,
    content: string,
    recipients: Recipient[],
    cc?: Recipient[],
    bcc?: Recipient[]
  ) => Promise<Chat>;
  getCanteenBalances?: () => Promise<Balance[]>;
  getCanteenTransactionsHistory?: () => Promise<CanteenHistoryItem[]>;
  getCanteenQRCodes?: () => Promise<QRCode>;
  getCanteenBookingWeek?: (weekNumber: number) => Promise<BookingDay[]>;
  setMealAsBooked?: (meal: Booking, booked?: boolean) => Promise<Booking>;
}

/*
 *
 * Represents the capabilities of a school service plugin.
 * Used to determine what features the plugin supports.
 */
export enum Capabilities {
  REFRESH,
  HOMEWORK,
  NEWS,
  GRADES,
  ATTENDANCE,
  ATTENDANCE_PERIODS,
  CANTEEN_MENU,
  CHAT_READ,
  CHAT_CREATE,
  CHAT_REPLY,
  TIMETABLE,
  HAVE_KIDS,
  CANTEEN_BALANCE,
  CANTEEN_HISTORY,
  CANTEEN_BOOKINGS,
  CANTEEN_QRCODE,
  EVALUATIONS,
  REPORT,
  TEACHING_STAFF,
  PROFILE,
  TIMETABLE_PDF,
}

/**
 * Represents a generic interface for objects that have a createdByAccount property.
 *
 * @property {string} createdByAccount - The local account that created the object, useful for the manager.
 */
export interface GenericInterface {
  createdByAccount: string;
  fromCache?: boolean;
  kidName?: string;
}

export type FetchOptions<T> = {
  clientId?: string;
  fallback?: () => Promise<T>;
  saveToCache?: (data: T) => Promise<void>;
};
