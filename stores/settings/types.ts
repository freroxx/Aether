import { Colors } from "@/utils/colors";
import { AppFontFamily } from "@/utils/theme/fonts";

export interface SettingsStorage {
  personalization: Personalization;
  reset: () => void;
  mutateProperty: <T extends keyof SettingsState>(
    section: T,
    updates: Partial<SettingsState[T]>
  ) => void;
}

export interface SettingsState {
  personalization: Personalization;
}

export interface Path {
  directory: string;
  name: string;
}

export type WallpaperType = "image" | "gradient";

export interface WallpaperGradient {
  colors: string[];
  angle?: number;
  name?: string;
}

export interface Wallpaper {
  id: string;
  type?: WallpaperType;
  gradient?: WallpaperGradient;
  url?: string;
  path?: Path;
  thumbnail?: string;
  credit?: string;
  isBundled?: boolean;
}

export interface NotificationsPrefs {
  tasksEnabled?: boolean;
  tasksDelayMin?: number;
  notesEnabled?: boolean;
  messagesEnabled?: boolean;
  permissionGranted?: boolean;
  lastNotifiedTaskIds?: string[];
}

export interface Personalization {
  fontFamily?: AppFontFamily;
  gradesDisplayScale?: "20" | "10" | "5" | "percentage";
  colorSelected?: Colors;
  theme?: "light" | "dark" | "auto" | "amoled";
  useMaterialYou?: boolean;
  iOSBottomAccessoryEnabled?: boolean;
  showTabBarLabels?: boolean;
  hideNameOnHomeScreen?: boolean;
  showAlertAtLogin?: boolean;
  showDevMode?: boolean;
  mockDataEnabled?: boolean;
  language?: string | null;
  wallpaper?: Wallpaper;
  disabledTabs?: string[];
  disabledTabsByAccount?: Record<string, string[]>;
  gradesSortMethod?: string;
  gradesPeriodName?: string;
  welcomeModalSeen?: boolean;
  enabledCalendarIds?: string[];
  showWeekendsOnTimetable?: boolean;
  pronoteApiUrl?: string;
  /** UUID stable de l'appareil pour les logins Pronote (ne change jamais). */
  deviceUuid?: string;
  notifications?: NotificationsPrefs;
  /** Flat notifications prefs (contract): Tasks live, Notes/Messages locked. */
  notificationsTasksEnabled?: boolean;
  notificationsTasksDelayMin?: number;
  notificationsNotesEnabled?: boolean;
  notificationsMessagesEnabled?: boolean;
  lastNotifiedTaskIds?: string[];
  lastNotifiedGradeIds?: string[];
  /** Rappels liés aux tâches. */
  taskReminders?: TaskReminder[];
  /** Sync auto des cours vers un calendrier appareil dédié "Aether". */
  androidCalendarSyncEnabled?: boolean;
  aetherCalendarId?: string;
  /** Mapping cours Aether (courseId) -> événement appareil (eventId). */
  calendarEventMap?: Record<string, string>;
  /** Info "agenda externe en lecture seule" déjà affichée. */
  calendarWarningSeen?: boolean;
  /** Cible d'export unique (max 1) : compte + enfant éventuel. */
  androidCalendarExportTarget?: { accountId: string; childName?: string } | null;
  /** Calendriers Aether par enfant : clé `${accountId}::${childName ?? ""}` -> calendarId. */
  aetherCalendarIdByChild?: Record<string, string>;
  /** Mappings par enfant : clé -> (courseId -> eventId). */
  calendarEventMapByChild?: Record<string, Record<string, string>>;
}

export interface TaskReminder {
  id: string;
  homeworkId: string;
  title: string;
  remindAt: number;
  enabled: boolean;
  createdAt: number;
  /** Répétition : none (défaut), hourly (toutes les heures), bihourly (toutes les 2h). */
  repeat?: "none" | "hourly" | "bihourly";
}
