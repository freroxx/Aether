import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import {
  areNotificationsEnabled,
  checkNewGradesAndNotify,
  checkNewTasksAndNotify,
  requestNotificationsPermission,
} from "@/services/local/notifications";
import { useSettingsStore } from "@/stores/settings";
import Icon from "@/ui/components/Icon";
import NativeSwitch from "@/ui/native/NativeSwitch";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";

export default function SettingsNotifications() {
  const theme = useTheme();
  const personalization = useSettingsStore(s => s.personalization);
  const mutateProperty = useSettingsStore(s => s.mutateProperty);

  const tasksEnabled =
    personalization.notificationsTasksEnabled ??
    personalization.notifications?.tasksEnabled ??
    false;
  const notesEnabled =
    personalization.notificationsNotesEnabled ??
    personalization.notifications?.notesEnabled ??
    false;

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    areNotificationsEnabled()
      .then(setPermissionGranted)
      .catch(() => setPermissionGranted(false));
  }, []);

  const handleAuthorize = useCallback(async () => {
    setRequesting(true);
    try {
      const granted = await requestNotificationsPermission();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert(
          "Notifications refusées",
          "Autorise les notifications dans les réglages Android pour recevoir les alertes."
        );
      }
    } finally {
      setRequesting(false);
    }
  }, []);

  const promptGrant = useCallback(() => {
    Alert.alert(
      "Autoriser les notifications",
      "Permission requise pour activer les notifications.",
      [
        { text: "Plus tard", style: "cancel" },
        { text: "Autoriser", onPress: () => void handleAuthorize() },
      ],
      { cancelable: true }
    );
  }, [handleAuthorize]);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (permissionGranted === true) return true;
    const granted = await areNotificationsEnabled().catch(() => false);
    setPermissionGranted(granted);
    if (!granted) promptGrant();
    return granted;
  }, [permissionGranted, promptGrant]);

  const handleTasksToggle = useCallback(
    async (next: boolean) => {
      if (next && !(await ensurePermission())) return;
      const prev = useSettingsStore.getState().personalization;
      mutateProperty("personalization", {
        notificationsTasksEnabled: next,
        notifications: { ...prev.notifications, tasksEnabled: next },
      });
      if (next) {
        // Vérif immédiate au toggle (attrape très vite les nouveaux devoirs)
        checkNewTasksAndNotify().catch(() => {});
      }
    },
    [ensurePermission, mutateProperty]
  );

  const handleNotesToggle = useCallback(
    async (next: boolean) => {
      if (next && !(await ensurePermission())) return;
      const prev = useSettingsStore.getState().personalization;
      mutateProperty("personalization", {
        notificationsNotesEnabled: next,
        notifications: { ...prev.notifications, notesEnabled: next },
      });
      if (next) {
        checkNewGradesAndNotify().catch(() => {});
      }
    },
    [ensurePermission, mutateProperty]
  );

  const permissionBadge = permissionGranted === true;

  return (
    <List
      contentInsetAdjustmentBehavior="always"
      contentContainerStyle={{ padding: 16 }}
      style={{ flex: 1 }}
    >
      <List.Section>
        <List.SectionTitle>
          <List.Label>Autorisation</List.Label>
        </List.SectionTitle>
        <List.Item>
          <List.Leading>
            <Icon>
              <Papicons name={"Bell"} />
            </Icon>
          </List.Leading>
          <Typography variant="title">Autoriser les notifications</Typography>
          <Typography color="textSecondary" numberOfLines={2}>
            Permission requise, fonctionne en arrière-plan sans restriction.
          </Typography>
          <List.Trailing>
            {permissionBadge ? (
              <View
                style={{
                  backgroundColor: `${String(theme.colors.primary)}22`,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                }}
              >
                <Typography variant="body1" weight="bold" style={{ color: theme.colors.primary }}>
                  Activée
                </Typography>
              </View>
            ) : (
              <Pressable
                onPress={() => void handleAuthorize()}
                disabled={requesting}
                style={({ pressed }) => ({
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  opacity: pressed || requesting ? 0.75 : 1,
                })}
              >
                <Typography variant="body1" weight="bold" style={{ color: "#FFFFFF" }}>
                  {requesting ? "…" : "Autoriser"}
                </Typography>
              </Pressable>
            )}
          </List.Trailing>
        </List.Item>
      </List.Section>

      <List.Section>
        <List.SectionTitle>
          <List.Label>Devoirs</List.Label>
        </List.SectionTitle>

        <List.Item onPress={() => void handleTasksToggle(!tasksEnabled)}>
          <List.Leading>
            <Icon>
              <Papicons name={"Tasks"} />
            </Icon>
          </List.Leading>
          <Typography variant="title">Notifications de tâches</Typography>
          <Typography color="textSecondary" numberOfLines={3}>
            Alerte dès qu&apos;un nouveau devoir arrive (vérif. toutes les 15 min + à chaque ouverture).
          </Typography>
          <List.Trailing>
            <NativeSwitch
              value={tasksEnabled}
              onValueChange={v => void handleTasksToggle(v)}
              disabled={permissionGranted === false}
            />
          </List.Trailing>
        </List.Item>
      </List.Section>

      <List.Section>
        <List.SectionTitle>
          <List.Label>Notes</List.Label>
        </List.SectionTitle>

        <List.Item onPress={() => void handleNotesToggle(!notesEnabled)}>
          <List.Leading>
            <Icon>
              <Papicons name={"Grades"} />
            </Icon>
          </List.Leading>
          <Typography variant="title">Notifications de notes</Typography>
          <Typography color="textSecondary" numberOfLines={3}>
            Alerte dès qu&apos;une nouvelle note arrive (vérif. toutes les 15 min + à chaque ouverture).
          </Typography>
          <List.Trailing>
            <NativeSwitch
              value={notesEnabled}
              onValueChange={v => void handleNotesToggle(v)}
              disabled={permissionGranted === false}
            />
          </List.Trailing>
        </List.Item>
      </List.Section>

      <List.Section>
        <List.SectionTitle>
          <List.Label>Bientôt</List.Label>
        </List.SectionTitle>

        <List.Item>
          <List.Leading>
            <Icon opacity={0.5}>
              <Papicons name={"TextBubble"} />
            </Icon>
          </List.Leading>
          <Typography variant="body2" color="primary">Bientôt</Typography>
          <Typography variant="title">Notifications de messages</Typography>
          <Typography color="textSecondary" numberOfLines={2}>
            Sois alerté des nouveaux messages. Bientôt disponible.
          </Typography>
          <List.Trailing>
            <NativeSwitch value={false} onValueChange={() => {}} disabled />
          </List.Trailing>
        </List.Item>
      </List.Section>
    </List>
  );
}
