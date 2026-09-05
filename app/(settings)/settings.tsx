import { Papicons } from '@getpapillon/papicons';
import { useTheme, useHeaderHeight } from "expo-router/react-navigation";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { t } from "i18next";
import { Calendar, InfoIcon, Palette, Sparkles, User, ShieldCheck } from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccountStore } from "@/stores/account";
import { useSettingsStore } from "@/stores/settings";
import Avatar from "@/ui/components/Avatar";
import Icon from "@/ui/components/Icon";
import MaterialIcon from "@/ui/components/MaterialIcon";
import Stack from "@/ui/components/Stack";
import adjust from "@/utils/adjustColor";
import { getInitials } from "@/utils/chats/initials";
import packagejson from "../../package.json";
import { formatSchoolName } from '@/utils/format/formatSchoolName';
import List, { ListTouchable } from '@/ui/new/List';
import Typography from '@/ui/new/Typography';

export default function SettingsIndex() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const accounts = useAccountStore((state) => state.accounts);
  const lastUsedAccount = useAccountStore((state) => state.lastUsedAccount);
  const settingsStore = useSettingsStore(state => state.personalization);
  const currentVersion = packagejson.version;
  const releaseNotesUrl = `https://github.com/aether-app/releases/tag/v${currentVersion}`;

  const account = accounts.find((a) => a.id === lastUsedAccount);

  const [firstName, lastName, level, establishment] = useMemo(() => {
    if (!account) { return [null, null, null, null]; }
    return [account.firstName, account.lastName, account.className, account.schoolName];
  }, [account]);

  const logout = useCallback(() => {
    const allAccounts = useAccountStore.getState().accounts;
    for (const acc of allAccounts) {
      useAccountStore.getState().removeAccount(acc);
    }
    router.replace("/(onboarding)/welcome");
  }, [router]);

  const BigButtons = [
    {
      icon: <Papicons name={"Palette"} />,
      title: "Apparence",
      description: "Thèmes & couleurs",
      color: "#17C300",
      onPress: () => router.navigate("/(settings)/personalization"),
    },
    {
      icon: <Papicons name={"Calendar"} />,
      title: "Matières",
      description: "Couleurs des cours",
      color: "#8500dd",
      onPress: () => router.navigate("/(settings)/subject_personalization"),
    },
    {
      icon: <Papicons name={"User"} />,
      title: "Comptes",
      description: "Gestion des profils",
      color: "#0059DD",
      onPress: () => router.navigate("/(settings)/accounts"),
    },
    {
      icon: <MaterialIcon name="auto-awesome" size={30} />,
      title: "OpenCode Zen",
      description: "Assistant local",
      color: "#DD007D",
      onPress: () => router.navigate("/(settings)/zen"),
    },
  ];

  const MoreSettingsList = [
    {
      title: "Configuration",
      content: [
        {
          title: t("Settings_Features_Title"),
          description: "Options avancées de l'interface",
          icon: <Sparkles size={20} color={theme.colors.primary} />,
          onPress: () => router.navigate("/(settings)/features"),
        },
        {
          title: "Calendriers Android",
          description: "Synchroniser avec les agendas de l'appareil",
          icon: <Calendar size={20} color={theme.colors.primary} />,
          onPress: () => router.push("/(settings)/android-calendars"),
        },
      ],
    },
    {
      title: "À propos",
      content: [
        {
          title: "À propos d'Aether",
          description: `Version ${currentVersion} · FOSS & Transparent`,
          icon: <ShieldCheck size={20} color="#29947A" />,
          onPress: () => router.navigate("/(settings)/about"),
        },
        {
          title: t("Settings_ReleaseNotes_Title"),
          description: "Découvrir les nouveautés de cette version",
          icon: <InfoIcon size={20} color={theme.colors.primary} />,
          onPress: () =>
            WebBrowser.openBrowserAsync(releaseNotesUrl, {
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
            }),
        },
      ],
    },
    {
      title: "Session",
      content: [
        {
          title: t("Settings_Logout_Title"),
          description: "Déconnecter tous les comptes",
          icon: <Papicons name={"Logout"} />,
          onPress: () => {
            Alert.alert(
              t("Settings_Logout_Title"),
              t("Settings_Logout_Description"),
              [
                { text: t("CANCEL_BTN"), style: "cancel" },
                { text: t("Settings_Logout_Title"), style: "destructive", onPress: logout },
              ],
              { cancelable: true }
            );
          },
        },
      ],
    },
    ...(settingsStore.showDevMode
      ? [
          {
            title: "Développement",
            content: [
              {
                title: "Mode développeur",
                description: "Options avancées et débogage",
                icon: <Papicons name={"Code"} />,
                onPress: () => router.navigate("/devmode"),
              },
            ],
          },
        ]
      : []),
  ];

  const finalHeaderHeight = Platform.select({
    android: headerHeight - 16,
    default: 0,
  });

  return (
    <List
      contentInsetAdjustmentBehavior="automatic"
      gap={12}
      ListHeaderComponent={
        <View style={{ marginVertical: 12, gap: 14 }}>
          {/* Profile card */}
          <Stack
            flex
            direction="vertical"
            hAlign="center"
            vAlign="center"
            gap={6}
            padding={[14, 0]}
            style={{ paddingBottom: 16 }}
          >
            <Avatar
              size={72}
              initials={getInitials(`${account?.firstName} ${account?.lastName}`)}
              imageUrl={
                account?.customisation?.profilePicture
                  ? `data:image/png;base64,${account.customisation.profilePicture}`
                  : undefined
              }
              style={{ marginBottom: 6 }}
            />
            <Typography variant="h3" weight="bold" align="center">
              {firstName || lastName
                ? `${firstName || ""} ${lastName || ""}`.trim()
                : t("Settings_NoAccount")}
            </Typography>
            {establishment && (
              <Typography variant="body1" align="center" color="textSecondary">
                {level} {level && establishment && " — "} {formatSchoolName(establishment)}
              </Typography>
            )}
            <View
              style={{
                backgroundColor: theme.dark ? "rgba(41,148,122,0.18)" : "rgba(41,148,122,0.12)",
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 12,
                marginTop: 4,
              }}
            >
              <Typography variant="caption" weight="bold" style={{ color: "#29947A", fontSize: 11 }}>
                Aether v{currentVersion} · Pronote FOSS
              </Typography>
            </View>
          </Stack>

          {/* Quick access grid */}
          <View style={{ gap: 10 }}>
            {Array.from({ length: Math.ceil(BigButtons.length / 2) }).map((_, rowIndex) => (
              <View key={rowIndex} style={{ flexDirection: "row", gap: 10 }}>
                {BigButtons.slice(rowIndex * 2, rowIndex * 2 + 2).map(button => {
                  const cardBg = theme.dark
                    ? adjust(button.color, -0.75)
                    : adjust(button.color, 0.85);
                  const iconColor = adjust(button.color, theme.dark ? 0.25 : -0.25);

                  return (
                    <Pressable
                      key={button.title}
                      onPress={button.onPress}
                      style={({ pressed }) => [
                        {
                          flex: 1,
                          backgroundColor: cardBg,
                          borderRadius: 22,
                          padding: 14,
                          gap: 10,
                          transform: [{ scale: pressed ? 0.97 : 1 }],
                          elevation: 1,
                          shadowColor: "#000",
                          shadowOpacity: 0.04,
                          shadowRadius: 6,
                          shadowOffset: { width: 0, height: 2 },
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: button.color + "25",
                        }}
                      >
                        <Icon papicon size={26} fill={iconColor}>
                          {button.icon}
                        </Icon>
                      </View>

                      <View style={{ gap: 2 }}>
                        <Typography variant="title" weight="bold" style={{ color: iconColor }}>
                          {button.title}
                        </Typography>
                        <Typography variant="caption" weight="medium" style={{ color: iconColor, opacity: 0.85 }}>
                          {button.description}
                        </Typography>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      }
      contentContainerStyle={{
        padding: 16,
        paddingBottom: insets.bottom + 24,
        paddingTop: finalHeaderHeight,
      }}
    >
      {MoreSettingsList.map(section => (
        <List.Section key={section.title}>
          <List.SectionTitle>
            <List.Label>{section.title}</List.Label>
          </List.SectionTitle>
          {section.content.map(item => (
            <List.Item key={item.title} onPress={item.onPress}>
              <List.Leading>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.colors.card,
                  }}
                >
                  <Icon papicon size={20} fill={theme.colors.text as string}>
                    {item.icon}
                  </Icon>
                </View>
              </List.Leading>
              <Typography variant="title" weight="bold">
                {item.title}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                {item.description}
              </Typography>
              <List.Trailing>
                <Papicons name="ChevronRight" opacity={0.5} size={20} />
              </List.Trailing>
            </List.Item>
          ))}
        </List.Section>
      ))}
    </List>
  );
}
