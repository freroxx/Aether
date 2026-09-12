import { useTheme } from "expo-router/react-navigation";
import { router } from "expo-router";
import type { NativeActionEvent } from "@react-native-menu/menu";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { t } from "i18next";

import { Chat } from "@/services/shared/chat";
import { getManager } from "@/services/shared";
import { generateMockChats } from "@/services/mock/data";
import { useAccountStore } from "@/stores/account";
import { error } from "@/utils/logger/logger";
import ActionMenu from "@/ui/components/ActionMenu";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import { useAlert } from "@/ui/components/AlertProvider";
import Avatar from "@/ui/components/Avatar";
import ConfirmModal from "@/ui/components/ConfirmModal";
import Icon from "@/ui/components/Icon";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import Typography from "@/ui/new/Typography";
import List from "@/ui/new/List";
import { getInitials } from "@/utils/chats/initials";

const HIDDEN_CHAT_LABELS = new Set(["trash", "draft", "drafts", "corbeille", "brouillon", "brouillons"]);

function getUnreadCount(chat: Chat): number {
  return Number((chat as { unread?: unknown }).unread ?? 0);
}

function isHiddenByLabel(chat: Chat): boolean {
  const labels = (chat as { labels?: unknown }).labels;
  if (!Array.isArray(labels)) return false;
  return labels.some(l => HIDDEN_CHAT_LABELS.has(String(l).toLowerCase().trim()));
}

function getVisibleLabels(chat: Chat): string[] {
  const labels = (chat as { labels?: unknown }).labels;
  if (!Array.isArray(labels)) return [];
  return (labels as unknown[])
    .map(l => String(l).trim())
    .filter(l => l.length > 0 && !HIDDEN_CHAT_LABELS.has(l.toLowerCase()));
}

export default function MessagesView() {
  const theme = useTheme();
  const isDark = theme.dark;
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [headerHeight, setHeaderHeight] = useState(0);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Chat | null>(null);
  const [deleting, setDeleting] = useState(false);

  const account = useAccountStore(state =>
    state.accounts.find(a => a.id === state.lastUsedAccount)
  );

  const load = useCallback(async () => {
    try {
      const manager = getManager();
      // Mocks TUÉS sur vrai compte : uniquement compte démo/invité (aucun service lié)
      const isDemoAccount = !account || (account.services?.length ?? 0) === 0;
      if (isDemoAccount) {
        const mocks = generateMockChats(account?.id || "guest");
        const sorted = [...mocks].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setChats(unreadOnly ? sorted.filter(c => getUnreadCount(c) > 0) : sorted);
        setIsUsingMock(true);
        return;
      }
      if (!manager) {
        // Vrai compte, manager pas prêt : jamais de mock
        setChats([]);
        setIsUsingMock(false);
        return;
      }

      const data = await manager.getChats(unreadOnly);
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
  }, [account, unreadOnly]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visibleChats = useMemo(() => {
    // Filtre serveur déjà appliqué via getChats(unreadOnly) ; garde-fou client
    // + exclusion des labels système (Trash/Drafts).
    return chats
      .filter(c => !isHiddenByLabel(c))
      .filter(c => (unreadOnly ? getUnreadCount(c) > 0 : true));
  }, [chats, unreadOnly]);

  const handleToggleRead = useCallback(async (chat: Chat) => {
    const isUnread = getUnreadCount(chat) > 0;
    try {
      if (isUsingMock) {
        setChats(prev =>
          prev.map(c => (c.id === chat.id ? { ...c, unread: isUnread ? 0 : 1 } : c))
        );
        return;
      }
      const manager = getManager();
      if (!manager) return;
      await manager.markChatAsRead(chat, isUnread);
      await load();
    } catch (e) {
      error(String(e));
      showAlert({
        title: t("Messages_ToggleRead_Failed_Title", "Action impossible"),
        message: t("Messages_ToggleRead_Failed_Description", "Impossible de mettre à jour cette discussion."),
        icon: "Cross",
        color: "#D60046",
      });
    }
  }, [isUsingMock, load, showAlert]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (isUsingMock) {
        setChats(prev => prev.filter(c => c.id !== pendingDelete.id));
      } else {
        const manager = getManager();
        if (manager) {
          await manager.deleteChat(pendingDelete);
        }
        await load();
      }
      setPendingDelete(null);
      showAlert({
        title: t("Messages_Deleted_Title", "Discussion supprimée"),
        icon: "Check",
        color: "#00C851",
      });
    } catch (e) {
      error(String(e));
      showAlert({
        title: t("Messages_Delete_Failed_Title", "Suppression impossible"),
        message: t("Messages_Delete_Failed_Description", "Impossible de supprimer cette discussion."),
        icon: "Cross",
        color: "#D60046",
      });
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, isUsingMock, load, showAlert]);

  const handleMenuAction = useCallback((chat: Chat) => (e: NativeActionEvent) => {
    const id = e.nativeEvent.event;
    if (id === "mark-read" || id === "mark-unread") {
      void handleToggleRead(chat);
    } else if (id === "delete") {
      setPendingDelete(chat);
    }
  }, [handleToggleRead]);

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
            subtitle={`${visibleChats.length} conversation${visibleChats.length > 1 ? "s" : ""}`}
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
      ) : visibleChats.length === 0 ? (
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
            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setUnreadOnly(false)}
                hitSlop={8}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: !unreadOnly
                      ? theme.colors.primary
                      : theme.colors.card,
                  },
                ]}
              >
                <Typography
                  variant="caption"
                  weight="bold"
                  style={{ color: !unreadOnly ? "#FFFFFF" : theme.colors.text }}
                >
                  {t("Messages_Filter_All", "Toutes")}
                </Typography>
              </Pressable>
              <Pressable
                onPress={() => setUnreadOnly(true)}
                hitSlop={8}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: unreadOnly
                      ? theme.colors.primary
                      : theme.colors.card,
                  },
                ]}
              >
                <Typography
                  variant="caption"
                  weight="bold"
                  style={{ color: unreadOnly ? "#FFFFFF" : theme.colors.text }}
                >
                  {t("Messages_Filter_Unread", "Non lues")}
                </Typography>
              </Pressable>
            </View>
            {visibleChats.map(chat => {
              const correspondent = (chat.recipient || chat.creator || "Enseignant").trim();
              const initials = getInitials(correspondent);
              const unreadCount = getUnreadCount(chat);
              const isClosed = Boolean((chat as { closed?: unknown }).closed);
              const labels = getVisibleLabels(chat);
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
                  {(isClosed || labels.length > 0) && (
                    <View style={styles.metaRow}>
                      {isClosed && (
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.08)"
                                : "rgba(0,0,0,0.06)",
                            },
                          ]}
                        >
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            style={{ fontSize: 11 }}
                          >
                            {t("Messages_Closed_Label", "Fermée")}
                          </Typography>
                        </View>
                      )}
                      {labels.slice(0, 2).map(label => (
                        <View
                          key={label}
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.08)"
                                : "rgba(0,0,0,0.06)",
                            },
                          ]}
                        >
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            numberOfLines={1}
                            style={{ fontSize: 11, maxWidth: 120 }}
                          >
                            {label}
                          </Typography>
                        </View>
                      ))}
                    </View>
                  )}

                  <List.Trailing>
                    <View style={styles.trailingRow}>
                      {unreadCount > 0 && (
                        <View
                          style={[
                            styles.unreadBadge,
                            { backgroundColor: theme.colors.primary },
                          ]}
                        >
                          <Typography
                            variant="caption"
                            weight="bold"
                            style={{ color: "#FFFFFF", fontSize: 11 }}
                          >
                            {unreadCount > 99 ? "99+" : String(unreadCount)}
                          </Typography>
                        </View>
                      )}
                      <ActionMenu
                        actions={[
                          {
                            id: unreadCount > 0 ? "mark-read" : "mark-unread",
                            title: unreadCount > 0
                              ? String(t("Messages_Mark_Read", "Marquer comme lu"))
                              : String(t("Messages_Mark_Unread", "Marquer comme non lu")),
                            image: Platform.select({
                              ios: unreadCount > 0 ? "envelope.open" : "envelope",
                            }) as never,
                          },
                          {
                            id: "delete",
                            title: String(t("Messages_Delete", "Supprimer")),
                            attributes: { destructive: true },
                            image: Platform.select({
                              ios: "trash",
                            }) as never,
                          },
                        ]}
                        onPressAction={handleMenuAction(chat)}
                      >
                        <View style={styles.dotsHitbox} collapsable={false}>
                          <Papicons
                            name="Dots"
                            size={20}
                            opacity={0.5}
                          />
                        </View>
                      </ActionMenu>
                      <Papicons
                        name="ChevronRight"
                        size={20}
                        opacity={0.5}
                      />
                    </View>
                  </List.Trailing>
                </List.Item>
              );
            })}
          </List.Section>
        </List>
      )}

      <ConfirmModal
        visible={!!pendingDelete}
        title={String(t("Messages_Delete_Title", "Supprimer la discussion ?"))}
        description={
          pendingDelete?.subject
            ? String(pendingDelete.subject)
            : String(t("Messages_Delete_Description", "Cette discussion sera supprimée de la messagerie."))
        }
        icon="Trash"
        destructive
        confirmLabel={String(t("Messages_Delete_Confirm", "Supprimer"))}
        cancelLabel={String(t("Common_Cancel", "Annuler"))}
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  trailingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dotsHitbox: {
    padding: 6,
    margin: -6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
});
