import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useTheme } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react-native";

import { useSettingsStore } from "@/stores/settings";
import {
  DeviceCalendarInfo,
  getDeviceCalendars,
  hasCalendarPermissions,
  requestCalendarPermissions,
} from "@/services/local/android-calendar";
import Typography from "@/ui/new/Typography";
import Stack from "@/ui/components/Stack";

export default function AndroidCalendarsScreen() {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [calendars, setCalendars] = useState<DeviceCalendarInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const enabledCalendarIds = useSettingsStore(
    state => state.personalization.enabledCalendarIds ?? []
  );
  const mutateProperty = useSettingsStore(state => state.mutateProperty);

  const checkAndLoad = useCallback(async () => {
    try {
      setLoading(true);
      const granted = await hasCalendarPermissions();
      setHasPermission(granted);

      if (granted) {
        const list = await getDeviceCalendars();
        setCalendars(list);
      }
    } catch (err) {
      console.warn("Error loading device calendars:", err);
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
        setCalendars(list);
      }
    } catch (err) {
      console.warn("Error requesting calendar permissions:", err);
    }
  };

  const toggleCalendar = (calId: string, currentVal: boolean) => {
    let next: string[];
    if (currentVal) {
      next = enabledCalendarIds.filter(id => id !== calId);
    } else {
      next = [...enabledCalendarIds, calId];
    }
    mutateProperty("personalization", {
      enabledCalendarIds: next,
    });
  };

  // Group calendars by account/source
  const grouped = calendars.reduce((acc, cal) => {
    const key = cal.source || "Appareil";
    if (!acc[key]) acc[key] = [];
    acc[key].push(cal);
    return acc;
  }, {} as Record<string, DeviceCalendarInfo[]>);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: 16,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 16,
        gap: 16,
      }}
    >
      {/* Intro banner */}
      <View style={[styles.introCard, { backgroundColor: colors.card }]}>
        <View
          style={[
            styles.introIconCircle,
            { backgroundColor: dark ? "rgba(41,148,122,0.2)" : "rgba(41,148,122,0.12)" },
          ]}
        >
          <Calendar size={28} color="#29947A" />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Typography variant="title" weight="bold">
            Calendriers de votre appareil
          </Typography>
          <Typography variant="body2" color="secondary">
            Synchronisez vos événements personnels (Google Agenda, Outlook, etc.) directement dans l&apos;emploi du temps Aether.
          </Typography>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : hasPermission === false ? (
        <View style={[styles.permissionCard, { backgroundColor: colors.card }]}>
          <ShieldAlert size={40} color="#E05D34" />
          <Typography variant="title" weight="bold" align="center">
            Autorisation requise
          </Typography>
          <Typography variant="body2" color="secondary" align="center">
            Aether a besoin d&apos;accéder aux calendriers de votre appareil pour afficher vos cours et rendez-vous côte à côte. Aucune donnée n&apos;est transmise en ligne.
          </Typography>

          <Pressable
            onPress={handleRequestPermission}
            style={({ pressed }) => [
              styles.grantButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Typography variant="body1" weight="bold" style={{ color: "#FFFFFF" }}>
              Autoriser l&apos;accès au calendrier
            </Typography>
          </Pressable>
        </View>
      ) : calendars.length === 0 ? (
        <View style={[styles.permissionCard, { backgroundColor: colors.card }]}>
          <Typography variant="title" align="center">
            Aucun calendrier trouvé sur l&apos;appareil
          </Typography>
          <Typography variant="body2" color="secondary" align="center">
            Vérifiez que vous avez configuré au moins un compte d&apos;agenda sur votre téléphone.
          </Typography>
        </View>
      ) : (
        Object.entries(grouped).map(([sourceName, sourceCals]) => (
          <View key={sourceName} style={styles.groupContainer}>
            <Typography
              variant="caption"
              weight="bold"
              style={{
                color: colors.primary,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginLeft: 4,
              }}
            >
              {sourceName}
            </Typography>

            <View style={[styles.calendarListCard, { backgroundColor: colors.card }]}>
              {sourceCals.map((cal, index) => {
                const isEnabled = enabledCalendarIds.includes(cal.id);
                return (
                  <View
                    key={cal.id}
                    style={[
                      styles.calendarRow,
                      index > 0 && styles.rowSeparator,
                      index > 0 && {
                        borderTopColor: dark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.06)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: cal.color || colors.primary },
                      ]}
                    />

                    <View style={{ flex: 1, gap: 2 }}>
                      <Typography variant="body1" weight="medium" numberOfLines={1}>
                        {cal.title}
                      </Typography>
                      {cal.isPrimary && (
                        <Typography variant="caption" color="secondary">
                          Calendrier principal
                        </Typography>
                      )}
                    </View>

                    <Switch
                      value={isEnabled}
                      onValueChange={() => toggleCalendar(cal.id, isEnabled)}
                      thumbColor={isEnabled ? (dark ? "#29947A" : "#20725E") : dark ? "#73777f" : "#e0e2ec"}
                      trackColor={{
                        false: dark ? "#3b4858" : "#d9e2ec",
                        true: dark ? "rgba(41, 148, 122, 0.45)" : "rgba(41, 148, 122, 0.35)",
                      }}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  introCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    gap: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  introIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionCard: {
    padding: 28,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
  },
  grantButton: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  groupContainer: {
    gap: 8,
  },
  calendarListCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  calendarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  rowSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
