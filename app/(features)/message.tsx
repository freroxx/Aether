import { useLocalSearchParams } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Chat, Message } from "@/services/shared/chat";
import { getManager } from "@/services/shared";
import { useAccountStore } from "@/stores/account";
import { error } from "@/utils/logger/logger";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import List from "@/ui/new/List";
import AetherTextInput from "@/ui/new/TextInput";
import Typography from "@/ui/new/Typography";

export default function MessageThreadView() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const search = useLocalSearchParams();
  const chatId = Array.isArray(search.id) ? search.id[0] : search.id;

  const account = useAccountStore(state =>
    state.accounts.find(a => a.id === state.lastUsedAccount)
  );
  const myName = useMemo(
    () =>
      [account?.firstName, account?.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    [account]
  );

  const [headerHeight, setHeaderHeight] = useState(0);
  const [chat, setChat] = useState<Chat | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const manager = getManager();
      if (!manager || !chatId) {
        return;
      }
      const chats = await manager.getChats();
      const found = chats.find(c => c.id === chatId);
      if (!found) {
        return;
      }
      setChat(found);
      const data = await manager.getChatMessages(found);
      setMessages(
        [...data].sort((a, b) => a.date.getTime() - b.date.getTime())
      );
    } catch (e) {
      error(String(e));
    }
  }, [chatId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || !chat || sending) {
      return;
    }
    setSending(true);
    try {
      const manager = getManager();
      await manager?.sendMessageInChat(chat, content);
      setDraft("");
      await load();
    } catch (e) {
      error(String(e));
    } finally {
      setSending(false);
    }
  }, [draft, chat, sending, load]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TabHeader
        showAndroidBackButton
        modal={Platform.OS !== "android"}
        onHeightChanged={setHeaderHeight}
        title={
          <TabHeaderTitle
            leading={chat?.subject || "Discussion"}
            subtitle={chat?.recipient}
            loading={loading}
          />
        }
      />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <List
            contentContainerStyle={{
              padding: 16,
              paddingTop: headerHeight + 8,
              paddingBottom: 8,
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {messages.length === 0 && (
              <List.Section id="thread-empty">
                <List.View>
                  <Typography variant="body1" color="secondary">
                    Aucun message dans cette discussion.
                  </Typography>
                </List.View>
              </List.Section>
            )}
            <List.Section id="thread">
              {messages.map(message => {
                const mine =
                  myName.length > 0 &&
                  message.author.toLowerCase().includes(myName.split(" ")[0]);
                return (
                  <List.View key={message.id}>
                    <View
                      style={{
                        alignSelf: mine ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        backgroundColor: mine
                          ? theme.colors.primary
                          : theme.colors.card,
                        borderRadius: 16,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        gap: 2,
                      }}
                    >
                      {!mine && (
                        <Typography
                          variant="caption"
                          weight="semibold"
                          color={mine ? undefined : "primary"}
                        >
                          {message.author}
                        </Typography>
                      )}
                      <Typography
                        variant="body1"
                        color={mine ? "#FFFFFF" : undefined}
                      >
                        {message.content}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={mine ? "#FFFFFF" : "textSecondary"}
                      >
                        {format(message.date, "d MMM · HH:mm", { locale: fr })}
                      </Typography>
                    </View>
                  </List.View>
                );
              })}
            </List.Section>
          </List>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 12,
              paddingTop: 4,
            }}
          >
            <View style={{ flex: 1 }}>
              <AetherTextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Écrire un message…"
                multiline
                height={48}
                editable={!sending}
                onSubmitEditing={send}
              />
            </View>
            <Typography
              variant="title"
              color="primary"
              onPress={send}
            >
              {sending ? "…" : "Envoyer"}
            </Typography>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
