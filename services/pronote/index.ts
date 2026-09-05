import { fetchPronoteAttendance, fetchPronoteAttendancePeriods } from "@/services/pronote/attendance";
import { fetchPronoteCanteenMenu } from "@/services/pronote/canteen";
import {
  createPronoteMail,
  fetchPronoteChatMessages,
  fetchPronoteChatRecipients,
  fetchPronoteChats,
  fetchPronoteRecipients,
  sendPronoteMessageInChat,
} from "@/services/pronote/chat";
import { fetchPronoteGradePeriods, fetchPronoteGrades } from "@/services/pronote/grades";
import { fetchPronoteHomeworks, setPronoteHomeworkAsDone } from "@/services/pronote/homework";
import { fetchPronoteNews, setPronoteNewsAsAcknowledged } from "@/services/pronote/news";
import { refreshPronoteAccount } from "@/services/pronote/refresh";
import { fetchPronoteCourseResources, fetchPronoteWeekTimetable } from "@/services/pronote/timetable";
import { Attendance } from "@/services/shared/attendance";
import { CanteenMenu } from "@/services/shared/canteen";
import { Chat, Message, Recipient } from "@/services/shared/chat";
import { Period, PeriodGrades } from "@/services/shared/grade";
import { Homework } from "@/services/shared/homework";
import { News } from "@/services/shared/news";
import { Course, CourseDay, CourseResource } from "@/services/shared/timetable";
import { Capabilities, SchoolServicePlugin } from "@/services/shared/types";
import { Kid } from "@/services/shared/kid";
import { useAccountStore } from "@/stores/account";
import { Auth, Services } from "@/stores/account/types";
import { error } from "@/utils/logger/logger";

export class Pronote implements SchoolServicePlugin {
  displayName = "PRONOTE";
  service = Services.PRONOTE;
  capabilities: Capabilities[] = [
    Capabilities.REFRESH,
    Capabilities.CANTEEN_MENU,
    Capabilities.CHAT_READ,
    Capabilities.CHAT_REPLY,
    Capabilities.CHAT_CREATE,
    Capabilities.TIMETABLE,
    Capabilities.GRADES,
    Capabilities.HOMEWORK,
    Capabilities.NEWS,
    Capabilities.ATTENDANCE,
    Capabilities.ATTENDANCE_PERIODS,
    Capabilities.HAVE_KIDS,
  ];
  session: any = undefined;
  tokenExpiration = 0;
  authData: Auth = {};
  private refreshInFlight: Promise<void> | null = null;

  constructor(public accountId: string) {}

  private getAuthToken(): string {
    return (
      this.authData.accessToken ||
      (this.authData.additionals?.auth_token as string) ||
      ""
    );
  }

  private getSelectedChildName(): string | undefined {
    const account = useAccountStore.getState().accounts.find(a => a.id === this.accountId);
    return account?.selectedChild;
  }

  private async checkTokenValidty(): Promise<void> {
    if (this.refreshInFlight) {
      await this.refreshInFlight;
      return;
    }
    if (Date.now() <= this.tokenExpiration) return;

    this.refreshInFlight = (async () => {
      await this.refreshAccount(this.authData);
      this.tokenExpiration = Date.now() + 5 * 60 * 1000;
    })().finally(() => {
      this.refreshInFlight = null;
    });

    await this.refreshInFlight;
  }

  async refreshAccount(credentials: Auth): Promise<Pronote> {
    const refresh = await refreshPronoteAccount(this.accountId, credentials);
    this.authData = refresh.auth;
    this.session = refresh.session;

    const capabilitiesSet = new Set<Capabilities>([
      Capabilities.REFRESH,
      Capabilities.CANTEEN_MENU,
      Capabilities.TIMETABLE,
      Capabilities.GRADES,
      Capabilities.HOMEWORK,
      Capabilities.NEWS,
      Capabilities.ATTENDANCE,
      Capabilities.ATTENDANCE_PERIODS,
      Capabilities.CHAT_READ,
      Capabilities.CHAT_REPLY,
      Capabilities.CHAT_CREATE,
      Capabilities.HAVE_KIDS,
    ]);

    this.capabilities = Array.from(capabilitiesSet);
    return this;
  }

  getKids(): Kid[] {
    const account = useAccountStore.getState().accounts.find(a => a.id === this.accountId);
    if (!account?.children?.length) return [];
    return account.children.map((c, idx) => ({
      id: `kid_${idx}_${c.name}`,
      firstName: c.name.split(" ")[0] || c.name,
      lastName: c.name.split(" ").slice(1).join(" ") || "",
      class: c.grade || "",
      dateOfBirth: new Date(),
      createdByAccount: this.accountId,
    }));
  }

  async getHomeworks(weekNumber: number): Promise<Homework[]> {
    await this.checkTokenValidty();
    return fetchPronoteHomeworks(
      this.getAuthToken(),
      this.accountId,
      weekNumber,
      this.getSelectedChildName()
    );
  }

  async getNews(): Promise<News[]> {
    await this.checkTokenValidty();
    return fetchPronoteNews(
      this.getAuthToken(),
      this.accountId,
      this.getSelectedChildName()
    );
  }

  async getGradesForPeriod(period: Period): Promise<PeriodGrades> {
    await this.checkTokenValidty();
    return fetchPronoteGrades(
      this.getAuthToken(),
      this.accountId,
      period,
      this.getSelectedChildName()
    );
  }

  async getGradesPeriods(): Promise<Period[]> {
    await this.checkTokenValidty();
    return fetchPronoteGradePeriods(
      this.getAuthToken(),
      this.accountId,
      this.getSelectedChildName()
    );
  }

  async getAttendanceForPeriod(period: string): Promise<Attendance> {
    await this.checkTokenValidty();
    return fetchPronoteAttendance(
      this.getAuthToken(),
      this.accountId,
      period,
      this.getSelectedChildName()
    );
  }

  async getAttendancePeriods(): Promise<Period[]> {
    await this.checkTokenValidty();
    return fetchPronoteAttendancePeriods(
      this.getAuthToken(),
      this.accountId,
      this.getSelectedChildName()
    );
  }

  async getWeeklyCanteenMenu(startDate: Date): Promise<CanteenMenu[]> {
    await this.checkTokenValidty();
    return fetchPronoteCanteenMenu(
      this.getAuthToken(),
      this.accountId,
      startDate,
      this.getSelectedChildName()
    );
  }

  async getWeeklyTimetable(weekNumber: number, date: Date): Promise<CourseDay[]> {
    await this.checkTokenValidty();
    return fetchPronoteWeekTimetable(
      this.getAuthToken(),
      this.accountId,
      weekNumber,
      date,
      this.getSelectedChildName()
    );
  }

  async getCourseResources(course: Course): Promise<CourseResource[]> {
    return [];
  }

  async getChats(): Promise<Chat[]> {
    await this.checkTokenValidty();
    return fetchPronoteChats(
      this.getAuthToken(),
      this.accountId,
      this.getSelectedChildName()
    );
  }

  async getChatRecipients(chat: Chat): Promise<Recipient[]> {
    return [];
  }

  async getChatMessages(chat: Chat): Promise<Message[]> {
    await this.checkTokenValidty();
    return fetchPronoteChatMessages(
      this.getAuthToken(),
      this.accountId,
      chat,
      this.getSelectedChildName()
    );
  }

  async getRecipientsAvailableForNewChat(): Promise<Recipient[]> {
    return [];
  }

  async sendMessageInChat(chat: Chat, content: string): Promise<void> {
    await this.checkTokenValidty();
    await sendPronoteMessageInChat(
      this.getAuthToken(),
      chat,
      content,
      this.getSelectedChildName()
    );
  }

  async setNewsAsAcknowledged(news: News): Promise<News> {
    await this.checkTokenValidty();
    return setPronoteNewsAsAcknowledged(this.getAuthToken(), news);
  }

  async setHomeworkCompletion(homework: Homework, state?: boolean): Promise<Homework> {
    await this.checkTokenValidty();
    return setPronoteHomeworkAsDone(
      this.getAuthToken(),
      homework,
      state,
      this.getSelectedChildName()
    );
  }

  async createMail(subject: string, content: string, recipients: Recipient[]): Promise<Chat> {
    await this.checkTokenValidty();
    return createPronoteMail(
      this.getAuthToken(),
      this.accountId,
      subject,
      content,
      recipients,
      this.getSelectedChildName()
    );
  }
}
