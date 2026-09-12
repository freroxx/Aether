import { Attendance } from "@/services/shared/attendance";
import { CanteenMenu } from "@/services/shared/canteen";
import { Chat, Message, Recipient } from "@/services/shared/chat";
import { Period, PeriodGrades, Evaluation, Report } from "@/services/shared/grade";
import { Homework } from "@/services/shared/homework";
import { News } from "@/services/shared/news";
import { CourseDay } from "@/services/shared/timetable";
import { Capabilities, SchoolServicePlugin } from "@/services/shared/types";
import { TeachingStaff } from "@/services/shared/staff";
import { Auth, Services } from "@/stores/account/types";

import {
  generateMockAttendance,
  generateMockCanteenMenu,
  generateMockChatMessages,
  generateMockChatRecipients,
  generateMockChats,
  generateMockEvaluations,
  generateMockGrades,
  generateMockHomeworks,
  generateMockNews,
  generateMockPeriods,
  generateMockReport,
  generateMockTeachingStaff,
  generateMockTimetable,
} from "./data";

export class MockData implements SchoolServicePlugin {
  displayName = "Mock Data";
  service = Services.MOCK_DATA;
  requiresInternet = false;
  capabilities = [
    Capabilities.HOMEWORK,
    Capabilities.NEWS,
    Capabilities.GRADES,
    Capabilities.ATTENDANCE,
    Capabilities.ATTENDANCE_PERIODS,
    Capabilities.TIMETABLE,
    Capabilities.CANTEEN_MENU,
    Capabilities.CHAT_READ,
    Capabilities.CHAT_REPLY,
    Capabilities.CHAT_CREATE,
    Capabilities.EVALUATIONS,
    Capabilities.REPORT,
    Capabilities.TEACHING_STAFF,
  ];
  authData: Auth = {};
  session = undefined;

  private homeworkState = new Map<string, boolean>();
  private newsState = new Map<string, boolean>();
  private sentMessages = new Map<string, Message[]>();

  constructor(public accountId: string) {}

  async refreshAccount(credentials: Auth): Promise<MockData> {
    this.authData = credentials;
    return this;
  }

  async getWeeklyTimetable(
    weekNumber: number,
    date: Date
  ): Promise<CourseDay[]> {
    return generateMockTimetable(this.accountId, weekNumber, date);
  }

  async getHomeworks(weekNumber: number): Promise<Homework[]> {
    return generateMockHomeworks(this.accountId, weekNumber).map(homework => ({
      ...homework,
      isDone: this.homeworkState.get(homework.id) ?? homework.isDone,
    }));
  }

  async setHomeworkCompletion(
    homework: Homework,
    state = !homework.isDone
  ): Promise<Homework> {
    this.homeworkState.set(homework.id, state);
    return { ...homework, isDone: state };
  }

  async getNews(opts?: { onlyUnread?: boolean }): Promise<News[]> {
    const all = generateMockNews(this.accountId).map(news => ({
      ...news,
      acknowledged: this.newsState.get(news.id) ?? news.acknowledged,
    }));
    if (opts?.onlyUnread) return all.filter(n => !n.acknowledged);
    return all;
  }

  async setNewsAsAcknowledged(news: News): Promise<News> {
    this.newsState.set(news.id, true);
    return { ...news, acknowledged: true };
  }

  async getGradesPeriods(): Promise<Period[]> {
    return generateMockPeriods(this.accountId);
  }

  async getGradesForPeriod(period: Period): Promise<PeriodGrades> {
    return generateMockGrades(this.accountId, period);
  }

  async getEvaluationsForPeriod(period: Period): Promise<Evaluation[]> {
    return generateMockEvaluations(this.accountId, period);
  }

  async getReportForPeriod(period: Period): Promise<Report | null> {
    return generateMockReport(this.accountId, period);
  }

  async getTeachingStaff(): Promise<TeachingStaff[]> {
    return generateMockTeachingStaff(this.accountId);
  }

  async getAttendancePeriods(): Promise<Period[]> {
    return generateMockPeriods(this.accountId);
  }

  async getAttendanceForPeriod(_period: string): Promise<Attendance> {
    return generateMockAttendance(this.accountId);
  }

  async getWeeklyCanteenMenu(startDate: Date): Promise<CanteenMenu[]> {
    return generateMockCanteenMenu(this.accountId, startDate);
  }

  async getChats(onlyUnread?: boolean): Promise<Chat[]> {
    const chats = generateMockChats(this.accountId);
    if (onlyUnread) {
      return chats.filter(c => Number((c as { unread?: unknown }).unread ?? 0) > 0);
    }
    return chats;
  }

  async getChatRecipients(): Promise<Recipient[]> {
    return generateMockChatRecipients(this.accountId);
  }

  async getChatMessages(chat: Chat): Promise<Message[]> {
    return [
      ...generateMockChatMessages(this.accountId, chat.id),
      ...(this.sentMessages.get(chat.id) ?? []),
    ];
  }

  async getRecipientsAvailableForNewChat(): Promise<Recipient[]> {
    return generateMockChatRecipients(this.accountId);
  }

  async sendMessageInChat(chat: Chat, content: string, messageId?: string): Promise<void> {
    const existing = this.sentMessages.get(chat.id) ?? [];
    existing.push({
      id: `mock-message-${chat.id}-sent-${existing.length}`,
      subject: "",
      content,
      author: "Camille Martin",
      date: new Date(),
      attachments: [],
      replyingTo: messageId ?? null,
    });
    this.sentMessages.set(chat.id, existing);
  }

  async createMail(
    subject: string,
    content: string,
    recipients: Recipient[]
  ): Promise<Chat> {
    void content;
    return {
      id: `mock-chat-${Date.now()}`,
      subject,
      recipient: recipients.map(r => r.name).join(", "),
      creator: "Camille Martin",
      date: new Date(),
      createdByAccount: this.accountId,
    };
  }
}
