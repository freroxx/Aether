import { router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
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
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Mail, MessageSquare, Sparkles, User } from "lucide-react-native";

import { Chat } from "@/services/shared/chat";
import { getManager } from "@/services/shared";
import { generateMockChats } from "@/services/mock/data";
import { useAccountStore } from "@/stores/account";
import { useSettingsStore } from "@/stores/settings";
import { error } from "@/utils/logger/logger";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import Avatar from "@/ui/components/Avatar";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import Typography from "@/ui/new/Typography";
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
  const mockDataEnabled = useSettingsStore(
    state => state.personalization.mockDataEnabled ?? false
  );

  const load = useCallback(async () => {
    try {
      const manager = getManager();
      if (!manager || !account) {
        const mock = generateMockChats("guest");
        setChats(mock);
        setIsUsingMock(true);
        return;
      }

      if (mockDataEnabled) {
        const mock = generateMockChats(account.id);
        setChats(mock);
        setIsUsingMock(true);
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
      if (mockDataEnabled || !account) {
        const mock = generateMockChats(account?.id || "guest");
        setChats(mock);
        setIsUsingMock(true);
      } else {
        setChats([]);
        setIsUsingMock(false);
      }
    }
  }, [account, mockDataEnabled]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator />
        </View>
      ) : (
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
          {isUsingMock && (
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
              <Sparkles size={14} color="#29947A" />
              <Typography
                variant="caption"
                weight="bold"
                style={{ color: "#29947A", flex: 1 }}
              >
                Mode démo actif : conversations simulées
              </Typography>
            </View>
          )}

          {chats.length === 0 ? (
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
                <Mail size={36} color={theme.colors.text} style={{ opacity: 0.4 }} />
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
          ) : (
            chats.map(chat => {
              const correspondent = (chat.recipient || chat.creator || "Enseignant").trim();
              const initials = getInitials(correspondent);
              const relativeTime = formatDistanceToNow(new Date(chat.date), {
                addSuffix: true,
                locale: fr,
              });

              return (
                <Pressable
                  key={chat.id}
                  onPress={() =>
                    router.push({
                      pathname: "/(features)/message",
                      params: { id: chat.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.chatCard,
                    {
                      backgroundColor: theme.colors.card,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Avatar
                    size={48}
                    initials={initials}
                    shape="circle"
                    style={styles.avatar}
                  />

                  <View style={styles.chatInfo}>
                    <View style={styles.chatTopRow}>
                      <Typography
                        variant="title"
                        weight="bold"
                        numberOfLines={1}
                        style={{ flex: 1, fontSize: 16 }}
                      >
                        {correspondent}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        style={{ fontSize: 11 }}
                      >
                        {relativeTime}
                      </Typography>
                    </View>

                    <Typography
                      variant="body1"
                      weight="medium"
                      numberOfLines={1}
                      style={{ color: theme.colors.primary, fontSize: 14 }}
                    >
                      {chat.subject || "Discussion"}
                    </Typography>

                    {chat.creator && chat.creator !== correspondent && (
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        numberOfLines={1}
                        style={{ fontSize: 12 }}
                      >
                        Initié par {chat.creator}
                      </Typography>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
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
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 22,
    gap: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  avatar: {
    alignSelf: "center",
  },
  chatInfo: {
    flex: 1,
    gap: 2,
  },
  chatTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
