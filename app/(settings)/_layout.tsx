import { Stack } from "expo-router";
import React from "react";
import { Platform, StatusBar } from "react-native";

import { runsIOS26 } from "@/ui/utils/IsLiquidGlass";
import { useScreenOptions } from "@/utils/theme/ScreenOptions";
import { t } from "i18next";
import AndroidHeaderBackground from "@/components/AndroidHeaderBackground";

export default function Layout() {
  const screenOptions = useScreenOptions();

  const newScreenOptions = React.useMemo(() => ({
    ...screenOptions,
    headerShown: true,
    headerLargeTitle: false,
    headerTransparent: runsIOS26,
    headerShadowVisible: false,
    headerBackground: AndroidHeaderBackground
  }), [screenOptions]);

  return (
    <>
      {Platform.OS === "ios" && <StatusBar barStyle="light-content" animated />}
      <Stack screenOptions={newScreenOptions}>
        <Stack.Screen
          name="settings"
          options={{
            headerTitle: t("Tab_Settings"),
            headerBackground: AndroidHeaderBackground,
            headerTransparent: true
          }}
        />

        <Stack.Screen
          name="services"
          options={{
            headerTitle: t("Settings_Services_Title"),
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="accounts"
          options={{
            headerTitle: t("Settings_Accounts_Title"),
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="personalization"
          options={{
            headerTitle: t("Settings_Personalization_Title"),
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: true,
            headerLargeTitle: false,
            headerBackground: null
          }}
        />

        <Stack.Screen
          name="about"
          options={{
            headerTitle: t("Settings_About_Title"),
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: Platform.OS === "ios",
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="contributors"
          options={{
            headerTitle: "Contributors",
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: false,
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="zen"
          options={{
            headerTitle: "OpenCode Zen",
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: false,
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="subject_personalization"
          options={{
            headerTitle: t("Settings_SubjectPersonalization_Title"),
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: false,
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="tabs"
          options={{
            headerTitle: t("Settings_Tabs_Title"),
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: false,
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="edit_subject"
          options={{
            headerTitle: t("Settings_SubjectEdit_Title"),
            headerBackButtonDisplayMode: "minimal",
            headerShown: false,
            presentation: "modal",
            contentStyle: {
              borderRadius: Platform.OS === "ios" ? 30 : 0,
            },
          }}
        />
        <Stack.Screen
          name="language"
          options={{
            headerTitle: t("Settings_Language_Title"),
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: false,
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="features"
          options={{
            headerTitle: t("Settings_Features_Title"),
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: false,
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="android-calendars"
          options={{
            headerTitle: "Calendriers Android",
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: false,
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerTitle: "Notifications",
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: false,
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="rappels"
          options={{
            headerTitle: "Rappels",
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: false,
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="qr-share"
          options={{
            headerTitle: t("Settings_QrShare_Title", "Partager via QR"),
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: false,
            headerLargeTitle: false,
          }}
        />
      </Stack>
    </>
  );
}
