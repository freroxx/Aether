import { useLocalSearchParams } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { Papicons } from "@getpapillon/papicons";
import { t } from "i18next";
import * as Haptics from "expo-haptics";

import { Chat, Message } from "@/services/shared/chat";
import { getManager } from "@/services/shared";
import { generateMockChatMessages, generateMockChats } from "@/services/mock/data";
import { useAccountStore } from "@/stores/account";
import { error } from "@/utils/logger/logger";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import Avatar from "@/ui/components/Avatar";
import Icon from "@/ui/components/Icon";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import Typography from "@/ui/new/Typography";
import { getInitials } from "@/utils/chats/initials";

function snippet(content: string, max = 80): string {
  const clean = String(content ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export default function MessageThreadView() {
  const theme = useTheme();
  const isDark = theme.dark;
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
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<string[] | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    setReplyTo(null);
    setRemoteParticipants(null);
  }, [chatId]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const manager = getManager();
      // Mocks TUÉS sur vrai compte : uniquement compte démo/invité
      const isDemoAccount = !account || (account.services?.length ?? 0) === 0;
      if (isDemoAccount) {
        const mockChats = generateMockChats(account?.id || "guest");
        const found = mockChats.find(c => c.id === chatId) || mockChats[0];
        setChat(found);
        if (found) {
          const mockMsgs = generateMockChatMessages(account?.id || "guest", found.id);
          setMessages([...mockMsgs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        }
        setIsUsingMock(true);
        return;
      }
      if (!manager) {
        setChat(undefined);
        setMessages([]);
        setIsUsingMock(false);
        return;
      }

      const chats = await manager.getChats();
      const found = chats.find(c => c.id === chatId);
      if (!found) {
        setChat(undefined);
        setMessages([]);
        setIsUsingMock(false);
        return;
      }

      setChat(found);
      const data = await manager.getChatMessages(found);
      setMessages([...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setIsUsingMock(false);
    } catch (e) {
      error(String(e));
      setChat(undefined);
      setMessages([]);
      setIsUsingMock(false);
    }
  }, [chatId, account]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!chat || isUsingMock) return;
    let cancelled = false;
    (async () => {
      try {
        const manager = getManager();
        if (!manager) return;
        const parts = await manager.getChatParticipants(chat);
        if (!cancelled && Array.isArray(parts) && parts.length > 0) {
          setRemoteParticipants(parts);
        }
      } catch {
        // best-effort : repli sur [creator, recipient]
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chat, isUsingMock]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleReply = useCallback((message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setReplyTo(message);
  }, []);

  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || !chat || sending) {
      return;
    }
    if (Boolean((chat as { closed?: unknown }).closed)) {
      return;
    }

    const replyId = replyTo?.id;
    setSending(true);
    try {
      const manager = getManager();
      if (!manager || isUsingMock) {
        // Mock send
        const newMsg: Message = {
          id: `mock-msg-${Date.now()}`,
          subject: "",
          content,
          author: account ? `${account.firstName} ${account.lastName}` : "Moi",
          date: new Date(),
          attachments: [],
          replyingTo: replyId ?? null,
        };
        setMessages(prev => [...prev, newMsg]);
        setDraft("");
        setReplyTo(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return;
      }

      await manager.sendMessageInChat(chat, content, replyId);
      setDraft("");
      setReplyTo(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await load();
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      error(String(e));
    } finally {
      setSending(false);
    }
  }, [draft, chat, sending, isUsingMock, load, account, replyTo]);

  const correspondent = chat?.recipient || chat?.creator || "Discussion";
  const isClosed = Boolean((chat as { closed?: unknown } | undefined)?.closed);
  const fallbackParticipants = useMemo(
    () =>
      [chat?.creator, chat?.recipient]
        .map(p => (p ?? "").trim())
        .filter((p, idx, arr) => p.length > 0 && arr.indexOf(p) === idx),
    [chat?.creator, chat?.recipient]
  );
  const participants = useMemo(
    () =>
      remoteParticipants && remoteParticipants.length > 0
        ? remoteParticipants
        : fallbackParticipants,
    [remoteParticipants, fallbackParticipants]
  );

  const messageById = useMemo(
    () => new Map(messages.map(m => [m.id, m] as const)),
    [messages]
  );

  const dayLabel = useCallback((date: Date) => {
    if (isToday(date)) return "Aujourd'hui";
    if (isYesterday(date)) return "Hier";
    const label = format(date, "EEEE d MMM", { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, []);

  const threadItems = useMemo(() => {
    const items: (
      | { kind: "day"; key: string; date: Date }
      | { kind: "message"; key: string; message: Message }
    )[] = [];
    let lastDay = "";
    for (const message of messages) {
      const date = new Date(message.date);
      const dayKey = isNaN(date.getTime())
        ? "unknown"
        : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (dayKey !== lastDay) {
        lastDay = dayKey;
        items.push({ kind: "day", key: `day-${dayKey}`, date });
      }
      items.push({ kind: "message", key: message.id, message });
    }
    return items;
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <TabHeader
        showAndroidBackButton
        modal={Platform.OS !== "android"}
        onHeightChanged={setHeaderHeight}
        title={
          <TabHeaderTitle
            leading={chat?.subject || correspondent}
            subtitle={chat?.subject ? correspondent : undefined}
            loading={loading}
          />
        }
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{
              paddingTop: headerHeight + 12,
              paddingBottom: 16,
              paddingHorizontal: 16,
              gap: 12,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
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
                <Papicons name="Sparkles" size={14} color="#29947A" />
                <Typography
                  variant="caption"
                  weight="bold"
                  style={{ color: "#29947A", flex: 1 }}
                >
                  Mode démonstration actif
                </Typography>
              </View>
            )}

            {participants.length > 0 && (
              <View
                style={[
                  styles.participantsCard,
                  { backgroundColor: theme.colors.card },
                ]}
              >
                <Papicons name="User" size={14} opacity={0.6} />
                <Typography
                  variant="caption"
                  color="textSecondary"
                  numberOfLines={2}
                  style={{ flex: 1 }}
                >
                  {t("Messages_Participants", "Participants")} · {participants.join(" · ")}
                </Typography>
              </View>
            )}

            {messages.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.colors.card }]}>
                <Icon size={32} opacity={0.4}>
                  {/* "Messages" n'existe pas dans papicons — TextBubble est l'équivalent */}
                  <Papicons name="TextBubble" />
                </Icon>
                <Typography variant="body1" color="textSecondary" align="center">
                  Aucun message dans cette discussion.
                </Typography>
              </View>
            ) : (
              threadItems.map(item => {
                if (item.kind === "day") {
                  return (
                    <View key={item.key} style={styles.dayDividerRow}>
                      <View
                        style={[
                          styles.dayDividerPill,
                          { backgroundColor: theme.colors.card },
                        ]}
                      >
                        <Typography
                          variant="caption"
                          weight="bold"
                          color="textSecondary"
                        >
                          {dayLabel(item.date)}
                        </Typography>
                      </View>
                    </View>
                  );
                }

                const message = item.message;
                const authorLower = message.author.toLowerCase();
                const mine =
                  myName.length > 0
                    ? authorLower.includes(myName.split(" ")[0]) ||
                      authorLower.includes("moi")
                    : false;

                const initials = getInitials(message.author);
                const quoted = message.replyingTo ? messageById.get(message.replyingTo) : undefined;

                return (
                  <View
                    key={message.id}
                    style={[
                      styles.messageRow,
                      mine ? styles.myMessageRow : styles.theirMessageRow,
                    ]}
                  >
                    {!mine && (
                      <Avatar
                        size={32}
                        initials={initials}
                        shape="circle"
                        style={styles.senderAvatar}
                      />
                    )}

                    <Pressable
                      onLongPress={isClosed ? undefined : () => handleReply(message)}
                      delayLongPress={380}
                      style={[
                        styles.bubble,
                        mine
                          ? [styles.myBubble, { backgroundColor: theme.colors.primary }]
                          : [styles.theirBubble, { backgroundColor: theme.colors.card }],
                      ]}
                    >
                      {!mine && (
                        <Typography
                          variant="caption"
                          weight="bold"
                          style={{ color: theme.colors.primary, marginBottom: 2 }}
                        >
                          {message.author}
                        </Typography>
                      )}

                      {message.replyingTo && (
                        <View
                          style={[
                            styles.quotedBox,
                            {
                              borderLeftColor: mine
                                ? "rgba(255,255,255,0.7)"
                                : String(theme.colors.primary),
                              backgroundColor: mine
                                ? "rgba(255,255,255,0.14)"
                                : isDark
                                  ? "rgba(255,255,255,0.06)"
                                  : "rgba(0,0,0,0.04)",
                            },
                          ]}
                        >
                          <Typography
                            variant="caption"
                            weight="bold"
                            numberOfLines={1}
                            style={{
                              color: mine ? "#FFFFFF" : String(theme.colors.primary),
                            }}
                          >
                            {quoted?.author ?? t("Messages_Reply_Unknown", "Message")}
                          </Typography>
                          <Typography
                            variant="caption"
                            color={mine ? undefined : "textSecondary"}
                            numberOfLines={2}
                            style={mine ? { color: "rgba(255,255,255,0.85)" } : undefined}
                          >
                            {quoted ? snippet(quoted.content) : t("Messages_Reply_Unavailable", "Message indisponible")}
                          </Typography>
                        </View>
                      )}

                      <Typography
                        variant="body1"
                        style={{
                          color: mine ? "#FFFFFF" : theme.colors.text,
                          lineHeight: 20,
                        }}
                      >
                        {message.content}
                      </Typography>

                      <Typography
                        variant="caption"
                        style={{
                          alignSelf: "flex-end",
                          fontSize: 10,
                          marginTop: 4,
                          color: mine ? "rgba(255,255,255,0.75)" : String(theme.colors.text) + "80",
                        }}
                      >
                        {format(new Date(message.date), "d MMM · HH:mm", { locale: fr })}
                        {mine && message.seen ? ` · ${t("Messages_Seen", "Vu")}` : ""}
                      </Typography>
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Bottom input bar */}
          {isClosed ? (
            <View
              style={[
                styles.closedNotice,
                {
                  paddingBottom: insets.bottom + (Platform.OS === "android" ? 10 : 8),
                  backgroundColor: theme.colors.background,
                  borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                },
              ]}
            >
              <View
                style={[
                  styles.closedPill,
                  { backgroundColor: theme.colors.card },
                ]}
              >
                <Papicons name="Info" size={16} opacity={0.6} />
                <Typography variant="body1" color="textSecondary" align="center">
                  {t("Messages_Closed_Notice", "Discussion fermée — réponse impossible.")}
                </Typography>
              </View>
            </View>
          ) : (
          <View
            style={[
              styles.inputBarContainer,
              {
                paddingBottom: isKeyboardVisible
                  ? 10
                  : insets.bottom + (Platform.OS === "android" ? 10 : 8),
                backgroundColor: theme.colors.background,
                borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <View style={styles.inputColumn}>
              {replyTo && (
                <View
                  style={[
                    styles.replyBar,
                    {
                      backgroundColor: theme.colors.card,
                      borderLeftColor: String(theme.colors.primary),
                    },
                  ]}
                >
                  <View style={styles.replyText}>
                    <Typography
                      variant="caption"
                      weight="bold"
                      numberOfLines={1}
                      style={{ color: theme.colors.primary }}
                    >
                      {replyTo.author}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      numberOfLines={1}
                    >
                      {snippet(replyTo.content)}
                    </Typography>
                  </View>
                  <Pressable
                    onPress={() => setReplyTo(null)}
                    hitSlop={10}
                    style={styles.replyCancel}
                  >
                    <Papicons name="Cross" size={16} opacity={0.6} />
                  </Pressable>
                </View>
              )}
              <View style={styles.inputRow}>
                <View
                  style={[
                    styles.textInputWrapper,
                    {
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                >
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Écrire un message…"
                    placeholderTextColor={String(theme.colors.text) + "60"}
                    multiline
                    editable={!sending}
                    style={[
                      styles.textInput,
                      {
                        color: theme.colors.text,
                      },
                    ]}
                  />
                </View>

                <Pressable
                  onPress={send}
                  disabled={sending || draft.trim().length === 0}
                  style={({ pressed }) => [
                    styles.sendButton,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: sending || draft.trim().length === 0 ? 0.4 : pressed ? 0.8 : 1,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
                  ]}
                  hitSlop={8}
                >
                  {sending ? (
                    <ActivityIndicator size={18} color="#FFFFFF" />
                  ) : (
                    /* "Send" n'existe pas dans papicons — ArrowUp (style iOS) */
                    <Papicons name="ArrowUp" size={18} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
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
    marginBottom: 6,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 12,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  dayDividerRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  dayDividerPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  theirMessageRow: {
    justifyContent: "flex-start",
  },
  senderAvatar: {
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  quotedBox: {
    borderLeftWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
    gap: 1,
  },
  myBubble: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 4,
  },
  inputBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputColumn: {
    gap: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderLeftWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyText: {
    flex: 1,
    gap: 1,
  },
  replyCancel: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  textInputWrapper: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    minHeight: 46,
    maxHeight: 120,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 15,
    padding: 0,
    margin: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  participantsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 2,
  },
  closedNotice: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  closedPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
