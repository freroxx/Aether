import { useTheme } from "expo-router/react-navigation";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Papicons } from "@getpapillon/papicons";

import { Chat } from "@/services/shared/chat";
import { getManager } from "@/services/shared";
import { generateMockChats } from "@/services/mock/data";
import { useAccountStore } from "@/stores/account";
import { error } from "@/utils/logger/logger";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import Avatar from "@/ui/components/Avatar";
import Icon from "@/ui/components/Icon";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import Typography from "@/ui/new/Typography";
import List from "@/ui/new/List";
import { getInitials } from "@/utils/chats/initials";

export default function MessagesView() {
  const theme = useTheme();
  const isDark = theme.dark;
  const insets = useSafeAreaInsets();

  const [headerHeight, setHeaderHeight] = useState(0);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUsingMock, setIsUsingMock] = useState(false);

  const account = useAccountStore(state =>
    state.accounts.find(a => a.id === state.lastUsedAccount)
  );

  const load = useCallback(async () => {
    try {
      const manager = getManager();
      // Mocks TUÉS sur vrai compte : uniquement compte démo/invité (aucun service lié)
      const isDemoAccount = !account || (account.services?.length ?? 0) === 0;
      if (isDemoAccount) {
        setChats(generateMockChats(account?.id || "guest"));
        setIsUsingMock(true);
        return;
      }
      if (!manager) {
        // Vrai compte, manager pas prêt : jamais de mock
        setChats([]);
        setIsUsingMock(false);
        return;
      }

      const data = await manager.getChats();
      if (!data) {
        setChats([]);
        setIsUsingMock(false);
      } else {
        setChats([...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setIsUsingMock(false);
      }
    } catch (e) {
      error(String(e));
      // Erreur sur vrai compte : jamais de mock, état vide
      setChats([]);
      setIsUsingMock(false);
    }
  }, [account]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const mockNotice = isUsingMock ? (
    <View
      style={[
        styles.mockNotice,
        {
          backgroundColor: isDark
            ? "rgba(41, 148, 122, 0.15)"
            : "rgba(41, 148, 122, 0.1)",
        },
      ]}
    >
      <Papicons name="Sparkles" size={14} color="#29947A" />
      <Typography
        variant="caption"
        weight="bold"
        style={{ color: "#29947A", flex: 1 }}
      >
        Mode démo actif : conversations simulées
      </Typography>
    </View>
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <TabHeader
        showAndroidBackButton
        modal={Platform.OS !== "android"}
        onHeightChanged={setHeaderHeight}
        title={
          <TabHeaderTitle
            leading="Messagerie"
            subtitle={`${chats.length} conversation${chats.length > 1 ? "s" : ""}`}
            loading={loading}
          />
        }
        trailing={
          isUsingMock ? undefined : (
            <Pressable
              onPress={() => router.push("/(features)/message-new")}
              hitSlop={10}
              style={{
                backgroundColor: `${String(theme.colors.primary)}1A`,
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Papicons name="Plus" size={20} color={String(theme.colors.primary)} />
            </Pressable>
          )
        }
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator />
        </View>
      ) : chats.length === 0 ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: headerHeight + 8,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 16,
            gap: 10,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        >
          {mockNotice}
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.card }]}>
            <View
              style={[
                styles.emptyIconCircle,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.04)",
                },
              ]}
            >
              <Icon size={36} opacity={0.4}>
                {/* "Messages" n'existe pas dans papicons — TextBubble est l'équivalent */}
                <Papicons name="TextBubble" />
              </Icon>
            </View>
            <Typography variant="title" weight="bold" align="center">
              Aucun message
            </Typography>
            <Typography
              variant="body1"
              color="textSecondary"
              align="center"
              style={{ maxWidth: 280 }}
            >
              Vos échanges avec les enseignants et la vie scolaire apparaîtront ici.
            </Typography>
          </View>
        </ScrollView>
      ) : (
        <List
          contentContainerStyle={{
            paddingTop: headerHeight + 8,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 16,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListHeaderComponent={mockNotice}
        >
          <List.Section>
            <List.SectionTitle>
              <List.Label>Messages</List.Label>
            </List.SectionTitle>
            {chats.map(chat => {
              const correspondent = (chat.recipient || chat.creator || "Enseignant").trim();
              const initials = getInitials(correspondent);
              const relativeTime = formatDistanceToNow(new Date(chat.date), {
                addSuffix: true,
                locale: fr,
              });

              return (
                <List.Item
                  key={chat.id}
                  href={{
                    pathname: "/(features)/message",
                    params: { id: chat.id },
                  }}
                >
                  <List.Leading>
                    <Avatar
                      size={44}
                      initials={initials}
                      shape="circle"
                    />
                  </List.Leading>

                  <Typography
                    variant="title"
                    weight="bold"
                    numberOfLines={1}
                    style={{ fontSize: 16 }}
                  >
                    {chat.subject || "Discussion"}
                  </Typography>
                  <Typography
                    variant="body1"
                    color="textSecondary"
                    numberOfLines={1}
                    style={{ fontSize: 14 }}
                  >
                    {correspondent} · {relativeTime}
                  </Typography>

                  <List.Trailing>
                    <Papicons
                      name="ChevronRight"
                      size={20}
                      opacity={0.5}
                    />
                  </List.Trailing>
                </List.Item>
              );
            })}
          </List.Section>
        </List>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  mockNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 4,
  },
  emptyCard: {
    borderRadius: 24,
    padding: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
});
