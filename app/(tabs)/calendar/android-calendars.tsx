import { Papicons } from "@getpapillon/papicons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useTheme } from "expo-router/react-navigation";

import { useAccountStore } from "@/stores/account";
import { useSettingsStore } from "@/stores/settings";
import {
  DeviceCalendarInfo,
  getDeviceCalendars,
  hasCalendarPermissions,
  requestCalendarPermissions,
} from "@/services/local/android-calendar";
import { AETHER_CALENDAR_TITLE } from "@/services/local/android-calendar-sync";
import Icon from "@/ui/components/Icon";
import { useAlert } from "@/ui/components/AlertProvider";
import ConfirmModal from "@/ui/components/ConfirmModal";
import Button from "@/ui/new/Button";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import NativeSwitch from "@/ui/native/NativeSwitch";
import { warn } from "@/utils/logger/logger";

function isAetherCalendar(cal: DeviceCalendarInfo, aetherId?: string): boolean {
  if (!cal) return false;
  if (aetherId && String(cal.id) === String(aetherId)) return true;
  // Couvre aussi les calendriers par enfant ("Aether – Léa").
  return typeof cal.title === "string" && cal.title.startsWith(AETHER_CALENDAR_TITLE);
}

export default function AndroidCalendarsScreen() {
  const theme = useTheme();
  const alert = useAlert();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [calendars, setCalendars] = useState<DeviceCalendarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // ConfirmModals (custom popup, jamais Alert.alert)
  const [showDisableExportModal, setShowDisableExportModal] = useState(false);
  const [showNeedExportModal, setShowNeedExportModal] = useState(false);
  const [showExternalInfoModal, setShowExternalInfoModal] = useState(false);
  const [showReplaceTargetModal, setShowReplaceTargetModal] = useState(false);
  const [showPurgeAllModal, setShowPurgeAllModal] = useState(false);
  const [purging, setPurging] = useState(false);
  const [pendingCalendarId, setPendingCalendarId] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<{ accountId: string; childName?: string; label: string } | null>(null);

  const rawIds = useSettingsStore(s => s.personalization.enabledCalendarIds);
  const enabledCalendarIds = rawIds ?? [];
  const syncEnabled = useSettingsStore(s => s.personalization.androidCalendarSyncEnabled ?? false);
  const aetherCalendarId = useSettingsStore(s => s.personalization.aetherCalendarId);
  const calendarWarningSeen = useSettingsStore(s => s.personalization.calendarWarningSeen ?? false);
  const exportTarget = useSettingsStore(s => s.personalization.androidCalendarExportTarget ?? null);
  const mutateProperty = useSettingsStore(state => state.mutateProperty);
  const accounts = useAccountStore(s => s.accounts);
  const lastUsedAccount = useAccountStore(s => s.lastUsedAccount);

  const exportChoices = React.useMemo(() => {
    const list: { accountId: string; childName?: string; label: string; sub: string }[] = [];
    for (const acc of accounts ?? []) {
      const name = `${acc.firstName ?? ""} ${acc.lastName ?? ""}`.trim() || "Compte";
      if (Array.isArray((acc as any)?.children) && (acc as any).children.length > 0) {
        for (const child of (acc as any).children) {
          const childName = typeof child === "string" ? child : child?.name;
          if (!childName) continue;
          list.push({
            accountId: acc.id,
            childName,
            label: String(childName),
            sub: `${name} · ${acc.schoolName ?? "Pronote"}`,
          });
        }
      } else {
        list.push({ accountId: acc.id, label: name, sub: acc.schoolName ?? "Pronote" });
      }
    }
    return list;
  }, [accounts]);

  const defaultTarget = React.useMemo(() => {
    if (exportTarget) return exportTarget;
    const acc = accounts.find(a => a.id === lastUsedAccount) ?? accounts[0];
    if (!acc) return null;
    const kids: any[] = Array.isArray((acc as any)?.children) ? (acc as any).children : [];
    const firstKid = kids.length > 0 ? (typeof kids[0] === "string" ? kids[0] : kids[0]?.name) : undefined;
    const selected = (acc as any)?.selectedChild ?? firstKid;
    return { accountId: acc.id, childName: selected };
  }, [exportTarget, accounts, lastUsedAccount]);

  const enableCalendarId = useCallback((calId: string) => {
    if (!calId) return;
    const current = useSettingsStore.getState().personalization.enabledCalendarIds ?? [];
    if (current.includes(calId)) return;
    mutateProperty("personalization", { enabledCalendarIds: [...current, calId] });
  }, [mutateProperty]);

  const handleSyncToggle = useCallback(async (next: boolean) => {
    if (next) {
      const granted = await hasCalendarPermissions();
      if (!granted) {
        const ok = await requestCalendarPermissions();
        if (!ok) return;
        setHasPermission(true);
      }
      // Cible unique (max 1) : défaut = compte courant + enfant sélectionné.
      const prefs = useSettingsStore.getState().personalization;
      let target = prefs.androidCalendarExportTarget;
      if (!target) {
        const st = useAccountStore.getState();
        const acc = st.accounts.find(a => a.id === st.lastUsedAccount) ?? st.accounts[0];
        if (acc) {
          target = { accountId: acc.id, childName: (acc as any)?.selectedChild };
          mutateProperty("personalization", { androidCalendarExportTarget: target });
        }
      } else {
        mutateProperty("personalization", { androidCalendarExportTarget: target });
      }
      mutateProperty("personalization", { androidCalendarSyncEnabled: true });
      try {
        const { ensureAetherCalendar } = await import("@/services/local/android-calendar-sync");
        const aetherId = await ensureAetherCalendar();
        const list = await getDeviceCalendars();
        setCalendars(Array.isArray(list) ? list : []);
        // Affiche automatiquement le calendrier « Aether » nouvellement créé.
        if (aetherId) {
          const current = useSettingsStore.getState().personalization.enabledCalendarIds ?? [];
          if (!current.includes(String(aetherId))) {
            mutateProperty("personalization", { enabledCalendarIds: [...current, String(aetherId)] });
          }
        }
      } catch (e) {
        warn(`Error enabling device calendar sync: ${String(e)}`);
        try {
          alert.showAlert({
            title: "Échec de l'export calendrier",
            message: e instanceof Error ? e.message : "Impossible d'activer « Exporter mes cours ».",
            icon: "Calendar",
          });
        } catch {
          // best-effort
        }
      }
    } else {
      // Gate sur les événements réellement exportés (pas sur l'affichage externe).
      const prefs = useSettingsStore.getState().personalization;
      const target = prefs.androidCalendarExportTarget;
      const key = target ? `${target.accountId}::${target.childName ?? ""}` : undefined;
      const mapSize = key
        ? Object.keys(prefs.calendarEventMapByChild?.[key] ?? {}).length
        : Object.keys(prefs.calendarEventMap ?? {}).length;
      if (mapSize > 0) {
        setShowDisableExportModal(true);
        return;
      }
      // Désactivé : on garde les événements déjà écrits (passé conservé).
      // L'affichage des agendas externes est conservé (seul l'export coupe).
      mutateProperty("personalization", { androidCalendarSyncEnabled: false });
    }
  }, [mutateProperty, alert]);

  const confirmDisableExport = useCallback(() => {
    // Couper l'export uniquement — les agendas affichés restent affichés.
    mutateProperty("personalization", { androidCalendarSyncEnabled: false });
    setShowDisableExportModal(false);
  }, [mutateProperty]);

  const pickExportTarget = useCallback((choice: { accountId: string; childName?: string; label: string }) => {
    const prefs = useSettingsStore.getState().personalization;
    const cur = prefs.androidCalendarExportTarget;
    const same =
      cur?.accountId === choice.accountId && (cur?.childName ?? "") === (choice.childName ?? "");
    if (same) return;
    if (syncEnabled && cur) {
      setPendingTarget(choice);
      setShowReplaceTargetModal(true);
      return;
    }
    mutateProperty("personalization", {
      androidCalendarExportTarget: { accountId: choice.accountId, childName: choice.childName },
    });
  }, [syncEnabled, mutateProperty]);

  const confirmReplaceTarget = useCallback(async () => {
    const next = pendingTarget;
    setShowReplaceTargetModal(false);
    setPendingTarget(null);
    if (!next) return;
    try {
      const syncMod = await import("@/services/local/android-calendar-sync");
      const prefs = useSettingsStore.getState().personalization;
      const cur = prefs.androidCalendarExportTarget;
      if (cur) {
        await syncMod.purgeChildFuture(syncMod.exportChildKey(cur.accountId, cur.childName));
      }
      mutateProperty("personalization", {
        androidCalendarExportTarget: { accountId: next.accountId, childName: next.childName },
      });
      const list = await getDeviceCalendars();
      setCalendars(Array.isArray(list) ? list : []);
    } catch (e) {
      warn(`Error replacing export target: ${String(e)}`);
    }
  }, [pendingTarget, mutateProperty]);

  const confirmPurgeAll = useCallback(async () => {
    if (purging) return;
    setPurging(true);
    try {
      const syncMod = await import("@/services/local/android-calendar-sync");
      const prefs = useSettingsStore.getState().personalization;
      const target = prefs.androidCalendarExportTarget;
      const key = target ? syncMod.exportChildKey(target.accountId, target.childName) : undefined;
      const n = await syncMod.purgeChildAll(key);
      setShowPurgeAllModal(false);
      alert.showAlert({
        title: "Calendrier nettoyé",
        description: n > 0 ? `${n} événement(s) supprimé(s).` : "Rien à supprimer.",
        icon: "Trash",
      });
    } catch (e) {
      warn(`Error purging device calendar: ${String(e)}`);
      alert.showAlert({
        title: "Échec du nettoyage",
        message: e instanceof Error ? e.message : "Impossible de nettoyer le calendrier.",
        icon: "AlertTriangle",
      });
    } finally {
      setPurging(false);
    }
  }, [purging, alert]);

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

  const handleResync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const syncMod = await import("@/services/local/android-calendar-sync");
      const aetherId = await syncMod.ensureAetherCalendar();
      const list = await getDeviceCalendars();
      setCalendars(Array.isArray(list) ? list : []);
      if (aetherId) {
        const current = useSettingsStore.getState().personalization.enabledCalendarIds ?? [];
        if (!current.includes(String(aetherId))) {
          mutateProperty("personalization", { enabledCalendarIds: [...current, String(aetherId)] });
        }
      }
      // Resynchronise les cours (fenêtre 7 j) vers le calendrier « Aether ».
      try {
        const [{ getCoursesFromCache }, { getWeekNumberFromDate }] = await Promise.all([
          import("@/database/useTimetable"),
          import("@/database/useHomework"),
        ]);
        const now = new Date();
        const wn = getWeekNumberFromDate(now);
        const days = await getCoursesFromCache([wn - 1, wn, wn + 1], now.getFullYear());
        const raw = (days || []).flatMap(d => d.courses ?? []);
        // Resync filtré : cible enfant unique + jamais de miroirs.
        const filtered = syncMod.filterCoursesForExport
          ? syncMod.filterCoursesForExport(raw)
          : raw;
        const allCourses = filtered.filter(c => {
          const mark = `${String((c as any)?.subject ?? "")} ${(c as any)?.teacher ?? ""} ${(c as any)?.room ?? ""}`;
          const owner = String((c as any)?.createdByAccount ?? "");
          if ((owner === 'android_calendar' || owner.startsWith('calendar_')) && mark.includes("Aether")) {
            return false;
          }
          return true;
        });
        await syncMod.syncCoursesToDeviceCalendar(allCourses);
      } catch (e) {
        warn(`Error resyncing device calendar courses: ${String(e)}`);
        throw e;
      }
    } catch (e) {
      warn(`Error resyncing device calendar: ${String(e)}`);
      try {
        alert.showAlert({
          title: "Échec de la resynchronisation",
          message: e instanceof Error ? e.message : "Impossible de resynchroniser tes cours.",
          icon: "Calendar",
        });
      } catch {
        // best-effort
      }
    } finally {
      setSyncing(false);
    }
  }, [syncing, mutateProperty, alert]);

  const toggleCalendar = (calId: string, currentVal: boolean) => {
    if (!calId) return;
    // Désactiver un calendrier : toujours autorisé, sans avertissement.
    if (currentVal) {
      mutateProperty("personalization", {
        enabledCalendarIds: enabledCalendarIds.filter(id => id !== calId),
      });
      return;
    }
    // Activation : détermine si c'est le calendrier Aether.
    const cal = calendars.find(c => String(c.id) === String(calId));
    const isAether = cal
      ? isAetherCalendar(cal, aetherCalendarId)
      : (aetherCalendarId ? String(calId) === String(aetherCalendarId) : false);
    const enabled = useSettingsStore.getState().personalization.androidCalendarSyncEnabled ?? false;

    // Bloque les agendas non-Aether tant que l'export est coupé.
    if (!isAether && !enabled) {
      setPendingCalendarId(calId);
      setShowNeedExportModal(true);
      return;
    }
    // Première sélection d'un agenda externe : info lecture seule.
    const seen = useSettingsStore.getState().personalization.calendarWarningSeen ?? false;
    if (!isAether && !seen) {
      setPendingCalendarId(calId);
      setShowExternalInfoModal(true);
      return;
    }
    const next = [...enabledCalendarIds, calId];
    mutateProperty("personalization", {
      enabledCalendarIds: next,
    });
  };

  const confirmNeedExport = useCallback(async () => {
    const targetId = pendingCalendarId;
    setShowNeedExportModal(false);
    setPendingCalendarId(null);
    // Le bouton active l'export directement, puis affiche le calendrier demandé.
    await handleSyncToggle(true);
    if (targetId) {
      enableCalendarId(targetId);
      // L'avertissement lecture seule est couvert par ce parcours : ne plus le redemander.
      const seen = useSettingsStore.getState().personalization.calendarWarningSeen ?? false;
      if (!seen) {
        mutateProperty("personalization", { calendarWarningSeen: true });
      }
    }
  }, [pendingCalendarId, handleSyncToggle, enableCalendarId, mutateProperty]);

  const confirmExternalInfo = useCallback(() => {
    const targetId = pendingCalendarId;
    setShowExternalInfoModal(false);
    setPendingCalendarId(null);
    mutateProperty("personalization", { calendarWarningSeen: true });
    if (targetId) {
      enableCalendarId(targetId);
    }
  }, [pendingCalendarId, enableCalendarId, mutateProperty]);

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
    <>
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
          <>
            {exportChoices.length > 1 ? (
              <List.Section>
                <List.SectionTitle>
                  <List.Label>Enfant exporté (max 1)</List.Label>
                </List.SectionTitle>
                {exportChoices.map(choice => {
                  const cur = exportTarget ?? defaultTarget;
                  const selected =
                    cur?.accountId === choice.accountId &&
                    (cur?.childName ?? "") === (choice.childName ?? "");
                  return (
                    <List.Item key={`${choice.accountId}-${choice.childName ?? "eleve"}`} onPress={() => pickExportTarget(choice)}>
                      <List.Leading>
                        <Icon>
                          <Papicons name={selected ? "Check" : "User"} />
                        </Icon>
                      </List.Leading>
                      <Typography variant="title" numberOfLines={1}>
                        {choice.label}
                      </Typography>
                      <Typography color="textSecondary" numberOfLines={1}>
                        {choice.sub}
                      </Typography>
                      <List.Trailing>
                        <Typography variant="caption" weight="bold" style={{ color: selected ? theme.colors.primary : undefined }}>
                          {selected ? "Exporté" : "Choisir"}
                        </Typography>
                      </List.Trailing>
                    </List.Item>
                  );
                })}
              </List.Section>
            ) : null}
          <List.Section>
            <List.SectionTitle>
              <List.Label>Synchronisation Aether</List.Label>
            </List.SectionTitle>
            <List.Item>
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
            {syncEnabled ? (
              <List.Item onPress={() => void handleResync()}>
                <List.Leading>
                  {syncing ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : (
                    <Icon>
                      <Papicons name={"Refresh"} />
                    </Icon>
                  )}
                </List.Leading>
                <Typography variant="title">Resynchroniser</Typography>
                <Typography color="textSecondary" numberOfLines={2}>
                  {syncing ? "Synchronisation en cours…" : "Réécrit tes cours des 7 prochains jours dans le calendrier « Aether »."}
                </Typography>
                <List.Trailing>
                  <Button
                    label={syncing ? "…" : "Lancer"}
                    onPress={() => void handleResync()}
                    disabled={syncing}
                    height={36}
                  />
                </List.Trailing>
              </List.Item>
            ) : null}
            {syncEnabled ? (
              <List.Item onPress={() => setShowPurgeAllModal(true)}>
                <List.Leading>
                  <Icon>
                    <Papicons name={"Trash"} />
                  </Icon>
                </List.Leading>
                <Typography variant="title">Nettoyer tout</Typography>
                <Typography color="textSecondary" numberOfLines={2}>
                  Efface tous les événements écrits par Aether (passé et futur) pour l'enfant exporté.
                </Typography>
                <List.Trailing>
                  <Button
                    label="Nettoyer"
                    onPress={() => setShowPurgeAllModal(true)}
                    height={36}
                  />
                </List.Trailing>
              </List.Item>
            ) : null}
          </List.Section>
          </>
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
        ) : (
          <List.Section>
            <List.SectionTitle>
              <List.Label>Calendrier Aether</List.Label>
            </List.SectionTitle>
            {(() => {
              const aetherCals = safeCalendars.filter(c =>
                c.title === AETHER_CALENDAR_TITLE || String(c.id) === String(aetherCalendarId)
              );
              if (aetherCals.length === 0) {
                return (
                  <List.Item>
                    <List.Leading>
                      <Icon opacity={0.5}>
                        <Papicons name={"Calendar"} />
                      </Icon>
                    </List.Leading>
                    <Typography variant="title">Aucun calendrier Aether</Typography>
                    <Typography color="textSecondary" numberOfLines={2}>
                      Active « Exporter mes cours » pour créer le calendrier Aether.
                    </Typography>
                  </List.Item>
                );
              }
              return aetherCals.map(cal => (
                <List.Item key={String(cal.id)}>
                  <List.Leading>
                    <Icon color={String(cal.color || theme.colors.primary)}>
                      <Papicons name={"Calendar"} />
                    </Icon>
                  </List.Leading>
                  <Typography variant="title" numberOfLines={1}>
                    {cal.title || "Aether"}
                  </Typography>
                  <Typography color="textSecondary" numberOfLines={1}>
                    Reçoit tes cours exportés
                  </Typography>
                </List.Item>
              ));
            })()}
          </List.Section>
        ))}
      </List>

      <ConfirmModal
        visible={showDisableExportModal}
        title="Désactiver l'export ?"
        description="L'export s'arrêtera, mais tes agendas affichés resteront affichés. Les événements déjà écrits sont conservés."
        icon="AlertTriangle"
        confirmLabel="Désactiver"
        cancelLabel="Garder"
        destructive
        onConfirm={confirmDisableExport}
        onClose={() => setShowDisableExportModal(false)}
      />

      <ConfirmModal
        visible={showReplaceTargetModal}
        title="Remplacer l'export ?"
        description={pendingTarget ? `Exporter « ${pendingTarget.label} » à la place ? Le futur de l'ancien enfant sera retiré du calendrier. Un seul enfant à la fois.` : "Un seul enfant à la fois."}
        icon="User"
        confirmLabel="Remplacer"
        cancelLabel="Annuler"
        onConfirm={() => void confirmReplaceTarget()}
        onClose={() => {
          setShowReplaceTargetModal(false);
          setPendingTarget(null);
        }}
      />

      <ConfirmModal
        visible={showPurgeAllModal}
        title="Nettoyer tout ?"
        description="Supprimer tous les événements écrits par Aether (passé et futur) pour l'enfant exporté ?"
        icon="Trash"
        confirmLabel="Tout supprimer"
        cancelLabel="Annuler"
        destructive
        loading={purging}
        onConfirm={() => void confirmPurgeAll()}
        onClose={() => { if (!purging) setShowPurgeAllModal(false); }}
      />

      <ConfirmModal
        visible={showNeedExportModal}
        title="Active d'abord Exporter mes cours"
        description="Pour afficher un agenda externe, active d'abord « Exporter mes cours ». Tu peux l'activer maintenant."
        icon="Calendar"
        confirmLabel="Activer l'export"
        cancelLabel="Plus tard"
        onConfirm={() => void confirmNeedExport()}
        onClose={() => {
          setShowNeedExportModal(false);
          setPendingCalendarId(null);
        }}
      />

      <ConfirmModal
        visible={showExternalInfoModal}
        title="Agenda externe en lecture seule"
        description="Tu affiches un agenda externe en lecture seule : Aether le montre mais ne le modifie pas. Seul le calendrier « Aether » reçoit tes cours exportés."
        icon="Info"
        confirmLabel="J'ai compris"
        cancelLabel="Annuler"
        onConfirm={confirmExternalInfo}
        onClose={() => {
          setShowExternalInfoModal(false);
          setPendingCalendarId(null);
        }}
      />
    </>
  );
}
