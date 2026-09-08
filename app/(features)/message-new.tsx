import { Papicons } from "@getpapillon/papicons";
import { router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getManager } from "@/services/shared";
import type { Recipient } from "@/services/shared/chat";
import type { TeachingStaff } from "@/services/shared/staff";
import { useAccountStore } from "@/stores/account";
import { useAlert } from "@/ui/components/AlertProvider";
import Avatar from "@/ui/components/Avatar";
import Search from "@/ui/components/Search";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import { getInitials } from "@/utils/chats/initials";
import { error as logError } from "@/utils/logger/logger";
import { t } from "i18next";

export default function NewMessageView() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const alert = useAlert();
  const account = useAccountStore(state =>
    state.accounts.find(a => a.id === state.lastUsedAccount)
  );

  const [headerHeight, setHeaderHeight] = useState(0);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [staff, setStaff] = useState<TeachingStaff[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selected, setSelected] = useState<Recipient[]>([]);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const manager = getManager();
        const list = (await manager?.getRecipientsAvailableForNewChat()) ?? [];
        if (!cancelled) setRecipients(list);
      } catch (e) {
        logError(String(e));
        if (!cancelled) {
          alert.showAlert({
            title: "Destinataires indisponibles",
            description: "Impossible de charger les destinataires.",
            icon: "Cross",
            color: "#D60046",
            delay: 3000,
          });
        }
      } finally {
        if (!cancelled) setLoadingRecipients(false);
      }
      try {
        const manager = getManager();
        const clientId = account?.services?.[0]?.id;
        if (manager && clientId) {
          const staffList = await manager.getTeachingStaff(clientId);
          if (!cancelled && Array.isArray(staffList) && staffList.length > 0) {
            setStaff(staffList);
          }
        }
      } catch {
        // Staff unavailable — section stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alert, account?.id]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(r =>
      (r.name ?? "").toLowerCase().includes(q) ||
      (r.class ?? "").toLowerCase().includes(q)
    );
  }, [recipients, searchText]);

  const filteredStaff = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(s =>
      (s.name ?? "").toLowerCase().includes(q) ||
      (s.subject ?? "").toLowerCase().includes(q)
    );
  }, [staff, searchText]);

  const toggleRecipient = useCallback((r: Recipient) => {
    setSelected(prev =>
      prev.some(s => s.id === r.id)
        ? prev.filter(s => s.id !== r.id)
        : [...prev, r]
    );
  }, []);

  const canSend = selected.length > 0 && subject.trim().length > 0 && content.trim().length > 0 && !sending;

  const send = useCallback(async () => {
    if (!canSend || !account) return;
    setSending(true);
    try {
      const manager = getManager();
      await manager?.createMail(account.id, subject.trim(), content.trim(), selected);
      alert.showAlert({
        title: "Discussion créée",
        description: "Ton message a été envoyé.",
        icon: "CheckCircle",
        color: "#00C851",
        delay: 2500,
      });
      router.replace("/(features)/messages");
    } catch (e) {
      logError(String(e));
      alert.showAlert({
        title: "Échec de l'envoi",
        description: "Impossible de créer la discussion. Réessaie.",
        icon: "Cross",
        color: "#D60046",
        delay: 3000,
      });
    } finally {
      setSending(false);
    }
  }, [canSend, account, subject, content, selected, alert]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <TabHeader
        showAndroidBackButton
        modal={Platform.OS !== "android"}
        onHeightChanged={setHeaderHeight}
        title={
          <TabHeaderTitle
            leading="Nouveau message"
            subtitle={selected.length > 0 ? `${selected.length} destinataire${selected.length > 1 ? "s" : ""}` : "Choisir des destinataires"}
          />
        }
        trailing={
          <Pressable
            onPress={send}
            disabled={!canSend}
            hitSlop={10}
            style={{
              backgroundColor: theme.colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              opacity: !canSend ? 0.4 : 1,
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Typography variant="body1" weight="bold" style={{ color: "#FFFFFF" }}>
                Envoyer
              </Typography>
            )}
          </Pressable>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: headerHeight + 8,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
          gap: 12,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Search
          placeholder="Rechercher un destinataire…"
          color={String(theme.colors.primary)}
          onTextChange={setSearchText}
        />

        {selected.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {selected.map(s => (
              <Pressable
                key={s.id}
                onPress={() => toggleRecipient(s)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: `${String(theme.colors.primary)}1A`,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 16,
                }}
              >
                <Typography variant="body1" weight="bold" style={{ color: theme.colors.primary }}>
                  {s.name}
                </Typography>
                <Papicons name="Cross" size={14} color={String(theme.colors.primary)} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ backgroundColor: theme.colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 }}>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Objet"
            placeholderTextColor={String(theme.colors.text) + "60"}
            editable={!sending}
            style={{ color: theme.colors.text, fontSize: 16, paddingVertical: 12 }}
          />
        </View>

        <View style={{ backgroundColor: theme.colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, minHeight: 140 }}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Écrire un message…"
            placeholderTextColor={String(theme.colors.text) + "60"}
            multiline
            editable={!sending}
            style={{ color: theme.colors.text, fontSize: 16, minHeight: 120, textAlignVertical: "top" }}
          />
        </View>

        <Typography variant="title" weight="bold">
          Destinataires
        </Typography>

        {loadingRecipients ? (
          <View style={{ alignItems: "center", padding: 24 }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <Typography color="textSecondary" align="center">
            Aucun destinataire trouvé.
          </Typography>
        ) : (
          <List style={{ backgroundColor: "transparent" }}>
            {filtered.map(r => {
              const isSelected = selected.some(s => s.id === r.id);
              return (
                <List.Item key={r.id} onPress={() => toggleRecipient(r)}>
                  <List.Leading>
                    <Avatar
                      size={36}
                      initials={getInitials(r.name ?? "")}
                      shape="circle"
                    />
                  </List.Leading>
                  <Typography variant="title" numberOfLines={1}>
                    {r.name}
                  </Typography>
                  {!!r.class && (
                    <Typography color="textSecondary" numberOfLines={1}>
                      {r.class}
                    </Typography>
                  )}
                  <List.Trailing>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSelected ? theme.colors.primary : "transparent",
                        borderWidth: isSelected ? 0 : 1.5,
                        borderColor: String(theme.colors.text) + "40",
                      }}
                    >
                      {isSelected && <Papicons name="Check" size={14} color="#FFFFFF" />}
                    </View>
                  </List.Trailing>
                </List.Item>
              );
            })}
          </List>
        )}

        {filteredStaff.length > 0 && (
          <>
            <Typography variant="title" weight="bold">
              {t("Messages_Staff_Title")}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {t("Messages_Staff_Description")}
            </Typography>
            <List style={{ backgroundColor: "transparent" }}>
              {filteredStaff.map(s => (
                <List.Item key={`staff-${s.name}-${s.subject}`}>
                  <List.Leading>
                    <Avatar
                      size={36}
                      initials={getInitials(s.name ?? "")}
                      shape="circle"
                    />
                  </List.Leading>
                  <Typography variant="title" numberOfLines={1}>
                    {s.name}
                  </Typography>
                  <Typography color="textSecondary" numberOfLines={1}>
                    {[s.subject, s.email].filter(Boolean).join(" · ")}
                  </Typography>
                </List.Item>
              ))}
            </List>
          </>
        )}
      </ScrollView>
    </View>
  );
}
