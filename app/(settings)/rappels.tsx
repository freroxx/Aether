import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import {
  areNotificationsEnabled,
  cancelTasksReminder,
  requestNotificationsPermission,
  scheduleTasksReminder,
} from "@/services/local/notifications";
import {
  cancelTaskReminder,
  setTaskReminderEnabled,
} from "@/services/local/reminders";
import { useSettingsStore } from "@/stores/settings";
import Icon from "@/ui/components/Icon";
import NativeSwitch from "@/ui/native/NativeSwitch";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";

function repeatLabel(repeat: import("@/stores/settings/types").TaskReminder["repeat"]): string | null {
  if (repeat === "hourly") return "Toutes les heures";
  if (repeat === "bihourly") return "Toutes les 2 heures";
  return null;
}

function formatRemindAt(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function SettingsRappels() {
  const theme = useTheme();
  const personalization = useSettingsStore(s => s.personalization);
  const mutateProperty = useSettingsStore(s => s.mutateProperty);

  const autoEnabled =
    personalization.notificationsTasksEnabled ??
    personalization.notifications?.tasksEnabled ??
    false;
  const delayMin =
    personalization.notificationsTasksDelayMin ??
    personalization.notifications?.tasksDelayMin ??
    120;
  const reminders = personalization.taskReminders ?? [];

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  useEffect(() => {
    areNotificationsEnabled()
      .then(setPermissionGranted)
      .catch(() => setPermissionGranted(false));
  }, []);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const granted = await areNotificationsEnabled().catch(() => false);
    setPermissionGranted(granted);
    if (!granted) {
      Alert.alert(
        "Autoriser les notifications",
        "Active les notifications pour recevoir tes rappels.",
        [{ text: "OK" }],
        { cancelable: true }
      );
    }
    return granted;
  }, []);

  const handleAutoToggle = useCallback(
    async (next: boolean) => {
      if (next && !(await ensurePermission())) return;
      const prev = useSettingsStore.getState().personalization;
      mutateProperty("personalization", {
        notificationsTasksEnabled: next,
        notifications: { ...prev.notifications, tasksEnabled: next },
      });
      try {
        if (next) {
          await requestNotificationsPermission();
          await scheduleTasksReminder(
            prev.notificationsTasksDelayMin ?? prev.notifications?.tasksDelayMin ?? delayMin
          );
        } else {
          await cancelTasksReminder();
        }
      } catch {
        // best-effort
      }
    },
    [ensurePermission, mutateProperty, delayMin]
  );

  const handleDelete = useCallback((id: string, title: string) => {
    Alert.alert("Supprimer le rappel ?", title, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => void cancelTaskReminder(id) },
    ]);
  }, []);

  return (
    <List
      contentInsetAdjustmentBehavior="always"
      contentContainerStyle={{ padding: 16 }}
      style={{ flex: 1 }}
    >
      <List.Section>
        <List.SectionTitle>
          <List.Label>Comment ça marche</List.Label>
        </List.SectionTitle>
        <List.Item>
          <List.Leading>
            <Icon>
              <Papicons name={"Info"} />
            </Icon>
          </List.Leading>
          <Typography variant="title">Ajouter un rappel à une tâche</Typography>
          <Typography color="textSecondary" numberOfLines={4}>
            Fais un appui long sur une tâche dans l&apos;onglet Tâches, choisis quand être rappelé
            (dans 1 h, ce soir, demain matin…), et retrouve-le ici.
          </Typography>
        </List.Item>
      </List.Section>

      <List.Section>
        <List.SectionTitle>
          <List.Label>Rappel automatique</List.Label>
        </List.SectionTitle>
        <List.Item onPress={() => void handleAutoToggle(!autoEnabled)}>
          <List.Leading>
            <Icon>
              <Papicons name={"Clock"} />
            </Icon>
          </List.Leading>
          <Typography variant="title">Me rappeler mes tâches</Typography>
          <Typography color="textSecondary" numberOfLines={3}>
            Reçois « Tu as encore X tâches à faire ! » et d&apos;autres messages variés.
          </Typography>
          <List.Trailing>
            <NativeSwitch
              value={autoEnabled}
              onValueChange={v => void handleAutoToggle(v)}
              disabled={permissionGranted === false}
            />
          </List.Trailing>
        </List.Item>
      </List.Section>

      <List.Section>
        <List.SectionTitle>
          <List.Label>Mes rappels ({reminders.filter(r => r.enabled).length})</List.Label>
        </List.SectionTitle>
        {reminders.length === 0 ? (
          <List.Item>
            <List.Leading>
              <Icon opacity={0.5}>
                <Papicons name={"Bell"} />
              </Icon>
            </List.Leading>
            <Typography variant="title">Aucun rappel</Typography>
            <Typography color="textSecondary" numberOfLines={2}>
              Appui long sur une tâche pour en ajouter un.
            </Typography>
          </List.Item>
        ) : (
          reminders
            .slice()
            .sort((a, b) => a.remindAt - b.remindAt)
            .map(r => (
              <List.Item
                key={r.id}
                onPress={() =>
                  Alert.alert(r.title, `Rappel le ${formatRemindAt(r.remindAt)}`, [{ text: "OK" }])
                }
              >
                <List.Leading>
                  <Icon>
                    <Papicons name={"Tasks"} />
                  </Icon>
                </List.Leading>
                <Typography variant="title" numberOfLines={2}>
                  {r.title}
                </Typography>
                <Typography color="textSecondary" numberOfLines={1}>
                  {repeatLabel(r.repeat) ? `${formatRemindAt(r.remindAt)} · ${repeatLabel(r.repeat)}` : formatRemindAt(r.remindAt)}
                </Typography>
                <List.Trailing>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      onPress={() => handleDelete(r.id, r.title)}
                      hitSlop={12}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 14,
                        backgroundColor: `${String(theme.colors.primary)}14`,
                      }}
                    >
                      <Typography variant="caption" weight="bold" style={{ color: theme.colors.primary }}>
                        Supprimer
                      </Typography>
                    </Pressable>
                    <NativeSwitch
                      value={r.enabled}
                      onValueChange={v => void setTaskReminderEnabled(r.id, v)}
                    />
                  </View>
                </List.Trailing>
              </List.Item>
            ))
        )}
      </List.Section>
    </List>
  );
}
