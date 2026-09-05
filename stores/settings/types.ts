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

export interface Personalization {
  fontFamily?: AppFontFamily;
  gradesDisplayScale?: "20" | "10" | "5" | "percentage";
  colorSelected?: Colors;
  theme?: "light" | "dark" | "auto";
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
  installedVersion?: string;
  releaseNotesSeenForVersion?: string;
  welcomeModalSeen?: boolean;
  enabledCalendarIds?: string[];
  showWeekendsOnTimetable?: boolean;
  pronoteApiUrl?: string;
}
