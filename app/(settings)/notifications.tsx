import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, PanResponder, Pressable, View } from "react-native";

import {
  areNotificationsEnabled,
  cancelTasksReminder,
  DELAY_PRESETS,
  formatDelay,
  requestNotificationsPermission,
  scheduleTasksReminder,
  snapToPreset,
} from "@/services/local/notifications";
import { useSettingsStore } from "@/stores/settings";
import Icon from "@/ui/components/Icon";
import NativeSwitch from "@/ui/native/NativeSwitch";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";

const LOG_MIN = Math.log(15);
const LOG_MAX = Math.log(10080);

function fractionForDelay(min: number): number {
  const clamped = Math.min(10080, Math.max(15, min));
  return (Math.log(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN);
}

function DelaySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (preset: number) => void;
}) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const startX = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const valueFromX = useCallback(
    (x: number) => {
      if (trackWidth <= 0) return snapToPreset(value);
      const f = Math.min(1, Math.max(0, x / trackWidth));
      return snapToPreset(Math.exp(LOG_MIN + f * (LOG_MAX - LOG_MIN)));
    },
    [trackWidth, value]
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: evt => {
          startX.current = evt.nativeEvent.locationX;
          onChangeRef.current(valueFromX(evt.nativeEvent.locationX));
        },
        onPanResponderMove: (evt, gesture) => {
          onChangeRef.current(valueFromX(startX.current + gesture.dx));
        },
      }),
    [valueFromX]
  );

  const fraction = fractionForDelay(value);
  const trackBg = (theme.colors as { border?: string }).border ?? "#88888844";
  const primary = theme.colors.primary;

  return (
    <View
      {...pan.panHandlers}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: formatDelay(value) }}
      onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
      style={{ height: 40, justifyContent: "center" }}
    >
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: trackBg,
          overflow: "visible",
        }}
      >
        <View
          style={{
            width: `${fraction * 100}%`,
            height: 6,
            borderRadius: 3,
            backgroundColor: primary,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: `${fraction * 100}%`,
            marginLeft: -12,
            top: -9,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: primary,
            elevation: 3,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
          }}
        />
      </View>
    </View>
  );
}

export default function SettingsNotifications() {
  const theme = useTheme();
  const personalization = useSettingsStore(s => s.personalization);
  const mutateProperty = useSettingsStore(s => s.mutateProperty);

  const tasksEnabled =
    personalization.notificationsTasksEnabled ??
    personalization.notifications?.tasksEnabled ??
    false;
  const tasksDelayMin =
    personalization.notificationsTasksDelayMin ??
    personalization.notifications?.tasksDelayMin ??
    120;

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    areNotificationsEnabled()
      .then(setPermissionGranted)
      .catch(() => setPermissionGranted(false));
  }, []);

  const setTasksPref = useCallback(
    (updates: { enabled?: boolean; delayMin?: number }) => {
      const prev = useSettingsStore.getState().personalization;
      const nextEnabled = updates.enabled ?? tasksEnabled;
      const nextDelay = updates.delayMin ?? tasksDelayMin;
      mutateProperty("personalization", {
        notificationsTasksEnabled: nextEnabled,
        notificationsTasksDelayMin: nextDelay,
        notifications: {
          ...prev.notifications,
          tasksEnabled: nextEnabled,
          tasksDelayMin: nextDelay,
        },
      });
    },
    [mutateProperty, tasksEnabled, tasksDelayMin]
  );

  const handleAuthorize = useCallback(async () => {
    setRequesting(true);
    try {
      const granted = await requestNotificationsPermission();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert(
          "Notifications refusées",
          "Autorise les notifications dans les réglages Android pour recevoir les rappels de devoirs."
        );
      }
    } finally {
      setRequesting(false);
    }
  }, []);

  const promptGrant = useCallback(() => {
    Alert.alert(
      "Autoriser les notifications",
      "Permission Android requise pour activer les rappels de devoirs.",
      [
        { text: "Plus tard", style: "cancel" },
        { text: "Autoriser", onPress: () => void handleAuthorize() },
      ],
      { cancelable: true }
    );
  }, [handleAuthorize]);

  const handleTasksToggle = useCallback(
    async (next: boolean) => {
      if (next && permissionGranted !== true) {
        const granted = await areNotificationsEnabled().catch(() => false);
        setPermissionGranted(granted);
        if (!granted) {
          promptGrant();
          return;
        }
      }
      setTasksPref({ enabled: next });
      try {
        if (next) await scheduleTasksReminder(tasksDelayMin);
        else await cancelTasksReminder();
      } catch {
        // best-effort
      }
    },
    [permissionGranted, promptGrant, setTasksPref, tasksDelayMin]
  );

  const handleTasksRowPress = useCallback(() => {
    if (permissionGranted !== true) {
      promptGrant();
      return;
    }
    void handleTasksToggle(!tasksEnabled);
  }, [permissionGranted, promptGrant, handleTasksToggle, tasksEnabled]);

  const handleDelayChange = useCallback(
    (preset: number) => {
      if (preset === tasksDelayMin) return;
      setTasksPref({ delayMin: preset });
      if (tasksEnabled) {
        scheduleTasksReminder(preset).catch(() => {});
      }
    },
    [setTasksPref, tasksDelayMin, tasksEnabled]
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
            Permission Android requise, fonctionne en arrière-plan sans restriction.
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

        <List.Item onPress={handleTasksRowPress}>
          <List.Leading>
            <Icon>
              <Papicons name={"Tasks"} />
            </Icon>
          </List.Leading>
          <Typography variant="title">Notifications de tâches</Typography>
          <Typography color="textSecondary" numberOfLines={3}>
            Rappel périodique + alerte à la réception de nouveaux devoirs (vérif. toutes les 15 min).
          </Typography>
          <List.Trailing>
            <NativeSwitch
              value={tasksEnabled}
              onValueChange={v => void handleTasksToggle(v)}
              disabled={permissionGranted === false}
            />
          </List.Trailing>
        </List.Item>

        {tasksEnabled && (
          <List.Item>
            <List.Leading>
              <Icon>
                <Papicons name={"Clock"} />
              </Icon>
            </List.Leading>
            <Typography variant="title">Rappel tous les…</Typography>
            <Typography variant="body1" weight="bold" style={{ color: theme.colors.primary }}>
              {formatDelay(tasksDelayMin)}
            </Typography>
            <View style={{ paddingTop: 10 }}>
              <DelaySlider value={tasksDelayMin} onChange={handleDelayChange} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
                {DELAY_PRESETS.map(preset => {
                  const selected = preset === tasksDelayMin;
                  return (
                    <Pressable
                      key={preset}
                      onPress={() => handleDelayChange(preset)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 16,
                        backgroundColor: selected
                          ? theme.colors.primary
                          : `${String(theme.colors.primary)}14`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        weight="bold"
                        style={{ color: selected ? "#FFFFFF" : theme.colors.primary }}
                      >
                        {formatDelay(preset)}
                      </Typography>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </List.Item>
        )}
      </List.Section>

      <List.Section>
        <List.SectionTitle>
          <List.Label>Bientôt</List.Label>
        </List.SectionTitle>

        <List.Item>
          <List.Leading>
            <Icon opacity={0.5}>
              <Papicons name={"Grades"} />
            </Icon>
          </List.Leading>
          <Typography variant="body2" color="primary">Bientôt</Typography>
          <Typography variant="title">Notifications de notes</Typography>
          <Typography color="textSecondary" numberOfLines={2}>
            Sois alerté dès qu&apos;une nouvelle note arrive. Bientôt disponible.
          </Typography>
          <List.Trailing>
            <NativeSwitch value={false} onValueChange={() => {}} disabled />
          </List.Trailing>
        </List.Item>

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
