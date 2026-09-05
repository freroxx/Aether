import { router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Chat } from "@/services/shared/chat";
import { getManager } from "@/services/shared";
import { error } from "@/utils/logger/logger";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";

export default function MessagesView() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const manager = getManager();
      if (!manager) {
        return;
      }
      const data = await manager.getChats();
      setChats(
        [...data].sort((a, b) => b.date.getTime() - a.date.getTime())
      );
    } catch (e) {
      error(String(e));
    }
  }, []);

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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <TabHeader
        showAndroidBackButton
        modal={Platform.OS !== "android"}
        onHeightChanged={setHeaderHeight}
        title={
          <TabHeaderTitle leading="Messages" loading={loading} />
        }
      />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <List
          contentContainerStyle={{
            padding: 16,
            paddingTop: headerHeight + 8,
            paddingBottom: insets.bottom + 16,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {chats.length === 0 && (
            <List.Section id="chats-empty">
              <List.View>
                <Typography variant="body1" color="secondary">
                  Aucune discussion pour le moment.
                </Typography>
              </List.View>
            </List.Section>
          )}
          <List.Section id="chats">
            {chats.map(chat => (
              <List.Item
                key={chat.id}
                id={chat.id}
                onPress={() =>
                  router.push({
                    pathname: "/(features)/message",
                    params: { id: chat.id },
                  })
                }
              >
                <List.Leading>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: theme.colors.card,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography variant="title" color="primary">
                      {(chat.subject || chat.recipient || "?")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </Typography>
                  </View>
                </List.Leading>
                <Typography variant="title" numberOfLines={1}>
                  {chat.subject || "Discussion"}
                </Typography>
                <Typography variant="body1" color="textSecondary" numberOfLines={1}>
                  {[chat.recipient, chat.creator].filter(Boolean).join(" · ")}
                </Typography>
                <List.Trailing>
                  <Typography variant="caption" color="textSecondary">
                    {format(chat.date, "d MMM", { locale: fr })}
                  </Typography>
                </List.Trailing>
              </List.Item>
            ))}
          </List.Section>
        </List>
      )}
    </View>
  );
}
