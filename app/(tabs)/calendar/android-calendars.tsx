import { Papicons } from "@getpapillon/papicons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useTheme } from "expo-router/react-navigation";

import { useSettingsStore } from "@/stores/settings";
import {
  DeviceCalendarInfo,
  getDeviceCalendars,
  hasCalendarPermissions,
  requestCalendarPermissions,
} from "@/services/local/android-calendar";
import Icon from "@/ui/components/Icon";
import Button from "@/ui/new/Button";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import NativeSwitch from "@/ui/native/NativeSwitch";
import { warn } from "@/utils/logger/logger";

export default function AndroidCalendarsScreen() {
  const theme = useTheme();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [calendars, setCalendars] = useState<DeviceCalendarInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const rawIds = useSettingsStore(s => s.personalization.enabledCalendarIds);
  const enabledCalendarIds = rawIds ?? [];
  const syncEnabled = useSettingsStore(s => s.personalization.androidCalendarSyncEnabled ?? false);
  const mutateProperty = useSettingsStore(state => state.mutateProperty);

  const handleSyncToggle = useCallback(async (next: boolean) => {
    if (next) {
      const granted = await hasCalendarPermissions();
      if (!granted) {
        const ok = await requestCalendarPermissions();
        if (!ok) return;
        setHasPermission(true);
      }
      mutateProperty("personalization", { androidCalendarSyncEnabled: true });
      try {
        const { ensureAetherCalendar } = await import("@/services/local/android-calendar-sync");
        await ensureAetherCalendar();
        const list = await getDeviceCalendars();
        setCalendars(Array.isArray(list) ? list : []);
      } catch {
        // best-effort
      }
    } else {
      // Désactivé : on garde les événements déjà écrits (passé conservé).
      mutateProperty("personalization", { androidCalendarSyncEnabled: false });
    }
  }, [mutateProperty]);

  const checkAndLoad = useCallback(async () => {
    try {
      setLoading(true);
      const granted = await hasCalendarPermissions();
      setHasPermission(granted);

      if (granted) {
        const list = await getDeviceCalendars();
        setCalendars(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      warn(`Error loading device calendars: ${String(err)}`);
      setCalendars([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAndLoad();
  }, [checkAndLoad]);

  const handleRequestPermission = async () => {
    try {
      const granted = await requestCalendarPermissions();
      setHasPermission(granted);
      if (granted) {
        const list = await getDeviceCalendars();
        setCalendars(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      warn(`Error requesting calendar permissions: ${String(err)}`);
    }
  };

  const toggleCalendar = (calId: string, currentVal: boolean) => {
    if (!calId) return;
    const next = currentVal
      ? enabledCalendarIds.filter(id => id !== calId)
      : [...enabledCalendarIds, calId];
    mutateProperty("personalization", {
      enabledCalendarIds: next,
    });
  };

  // Group calendars by account/source (guards: filter nulls, safe keys)
  const safeCalendars = Array.isArray(calendars) ? calendars.filter((c) => c && c.id) : [];
  const grouped = safeCalendars.reduce((acc, cal) => {
    if (!cal) return acc;
    const key = cal.source || "Appareil";
    if (!acc[key]) acc[key] = [];
    acc[key].push(cal);
    return acc;
  }, {} as Record<string, DeviceCalendarInfo[]>);

  return (
    <List
      contentInsetAdjustmentBehavior="always"
      contentContainerStyle={{ padding: 16 }}
      style={{ flex: 1 }}
    >
      {loading ? (
        <List.Section>
          <List.Item>
            <List.Leading>
              <ActivityIndicator color={theme.colors.primary} />
            </List.Leading>
            <Typography variant="title">Chargement…</Typography>
            <Typography color="textSecondary" numberOfLines={2}>
              Lecture des calendriers de l&apos;appareil.
            </Typography>
          </List.Item>
        </List.Section>
      ) : null}

      {!loading && hasPermission !== false && (
        <List.Section>
          <List.SectionTitle>
            <List.Label>Synchronisation Aether</List.Label>
          </List.SectionTitle>
          <List.Item onPress={() => void handleSyncToggle(!syncEnabled)}>
            <List.Leading>
              <Icon>
                <Papicons name={"Refresh"} />
              </Icon>
            </List.Leading>
            <Typography variant="title">Exporter mes cours</Typography>
            <Typography color="textSecondary" numberOfLines={3}>
              Écrit tes cours (7 prochains jours) dans un calendrier « Aether ». Le passé est conservé, le futur suit ton emploi du temps.
            </Typography>
            <List.Trailing>
              <NativeSwitch
                value={syncEnabled}
                onValueChange={v => void handleSyncToggle(v)}
              />
            </List.Trailing>
          </List.Item>
        </List.Section>
      )}

      {!loading && (hasPermission === false ? (
        <List.Section>
          <List.SectionTitle>
            <List.Label>Autorisation</List.Label>
          </List.SectionTitle>
          <List.Item>
            <List.Leading>
              <Icon>
                <Papicons name={"Calendar"} />
              </Icon>
            </List.Leading>
            <Typography variant="title">Accès au calendrier</Typography>
            <Typography color="textSecondary" numberOfLines={3}>
              Aether a besoin d&apos;accéder aux calendriers de votre appareil. Aucune donnée n&apos;est transmise en ligne.
            </Typography>
            <List.Trailing>
              <Button
                label="Autoriser"
                onPress={handleRequestPermission}
                height={36}
              />
            </List.Trailing>
          </List.Item>
        </List.Section>
      ) : safeCalendars.length === 0 ? (
        <List.Section>
          <List.Item>
            <List.Leading>
              <Icon opacity={0.5}>
                <Papicons name={"Calendar"} />
              </Icon>
            </List.Leading>
            <Typography variant="title">Aucun calendrier trouvé</Typography>
            <Typography color="textSecondary" numberOfLines={2}>
              Vérifiez que vous avez configuré au moins un compte d&apos;agenda sur votre téléphone.
            </Typography>
          </List.Item>
        </List.Section>
      ) : (
        Object.entries(grouped).map(([sourceName, sourceCals]) => (
          <List.Section key={sourceName}>
            <List.SectionTitle>
              <List.Label>{sourceName}</List.Label>
            </List.SectionTitle>
            {(Array.isArray(sourceCals) ? sourceCals : []).map((cal, index) => {
              if (!cal || !cal.id) return null;
              const key = cal.id ?? `cal-${index}`;
              const isEnabled = Boolean(enabledCalendarIds.includes(cal.id));
              return (
                <List.Item key={key}>
                  <List.Leading>
                    <Icon color={String(cal.color || theme.colors.primary)}>
                      <Papicons name={"Calendar"} />
                    </Icon>
                  </List.Leading>
                  <Typography variant="title" numberOfLines={1}>
                    {cal.title || "Calendrier"}
                  </Typography>
                  <Typography color="textSecondary" numberOfLines={1}>
                    {cal.isPrimary ? "Calendrier principal" : (cal.source || "Appareil")}
                  </Typography>
                  <List.Trailing>
                    <NativeSwitch
                      value={Boolean(isEnabled)}
                      onValueChange={() => toggleCalendar(cal.id, isEnabled)}
                    />
                  </List.Trailing>
                </List.Item>
              );
            })}
          </List.Section>
        )))
      )}
    </List>
  );
}
