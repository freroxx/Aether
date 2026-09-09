import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Platform } from "react-native";

import { Colors } from "@/utils/colors";

import { createMMKVStorage } from "../global";
import { Personalization,SettingsState, SettingsStorage } from "./types";

export const DEFAULT_MATERIAL_YOU_ENABLED =
  Platform.OS === "android" && typeof Platform.Version === "number" && Platform.Version >= 31;

const defaultPersonalization: Personalization = {
  fontFamily: "sn-pro",
  colorSelected: Colors.GREEN,
  theme: "auto",
  useMaterialYou: DEFAULT_MATERIAL_YOU_ENABLED,
  iOSBottomAccessoryEnabled: true,
  showTabBarLabels: true,
  hideNameOnHomeScreen: false,
  showAlertAtLogin: false,
  showDevMode: false,
  mockDataEnabled: false,
  gradesDisplayScale: "20",
  welcomeModalSeen: false,
  notifications: {
    tasksEnabled: false,
    tasksDelayMin: 120,
    notesEnabled: false,
    messagesEnabled: false,
    permissionGranted: false,
    lastNotifiedTaskIds: [],
  },
  notificationsTasksEnabled: false,
  notificationsTasksDelayMin: 120,
  notificationsNotesEnabled: false,
  notificationsMessagesEnabled: false,
  lastNotifiedTaskIds: [],
  androidCalendarSyncEnabled: false,
  enabledCalendarIds: [],
  calendarEventMap: {},
  calendarWarningSeen: false,
};

export const useSettingsStore = create<SettingsStorage>()(
  persist(
    (set, get) => ({
      personalization: defaultPersonalization,
      reset: () => { set({ personalization: defaultPersonalization }) },
      mutateProperty: <T extends keyof SettingsState>(
        section: T,
        updates: Partial<SettingsState[T]>
      ) => {
        set(state => ({
          ...state,
          [section]: {
            ...state[section],
            ...updates,
          },
        }));
      },
    }),
    {
      name: "settings-storage",
      storage: createMMKVStorage("settings"),
      version: 1,
    }
  )
);
