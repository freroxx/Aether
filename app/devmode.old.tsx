import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch } from "react-native";

import DevModeNotice from "@/components/DevModeNotice";
import LogIcon from "@/components/Log/LogIcon";
import { database } from "@/database";
import { useAccountStore } from '@/stores/account';
import { useLogStore, useNetworkStore } from '@/stores/logs';
import { useSettingsStore } from "@/stores/settings";
import { useAlert } from "@/ui/components/AlertProvider";
import Icon from "@/ui/components/Icon";
import Item, { Leading, Trailing } from '@/ui/components/Item';
import List from '@/ui/components/List';
import SectionHeader from "@/ui/components/SectionHeader";
import Typography from "@/ui/components/Typography";
import NativeSwitch from "@/ui/native/NativeSwitch";
import { scheduleNotificationAtDate } from "@/utils/notification/reminder/helper";
import NativeSwitch from "@/ui/native/NativeSwitch";

export default function Devmode() {
  const accountStore = useAccountStore();
  const logsStore = useLogStore();
  const settingStore = useSettingsStore(state => state.personalization)
  const mutateProperty = useSettingsStore(state => state.mutateProperty)

  const { colors } = useTheme();
  const alert = useAlert();

  const [showAccountStore, setShowAccountStore] = useState(false);
  const [showLogsStore, setShowLogsStore] = useState(false);

  const [visibleLogsCount, setVisibleLogsCount] = useState(20);

  const loadMoreLogs = () => {
    setVisibleLogsCount((prev) => prev + 20);
  };

  useEffect(() => {
    if (!showLogsStore) {
      setVisibleLogsCount(20);
    }


  }, [showLogsStore]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.containerContent}
      style={styles.container}
    >
      <DevModeNotice />

      <List>
        <Item>
          <Trailing>
            <NativeSwitch
              style={{ marginRight: 10 }}
              value={showLogsStore}
              onValueChange={() => {
                requestAnimationFrame(() => {
                  setShowLogsStore(!showLogsStore);
                });
              }}
            />
          </Trailing>
          <Typography variant="title">Logs Store</Typography>
        </Item>

        {showLogsStore &&
          logsStore.logs
            .slice()
            .reverse()
            .slice(0, visibleLogsCount)
            .map((logEntry, index) => (
              <Item key={index}>
                <Leading>
                  <LogIcon type={logEntry.type} />
                </Leading>
                <Typography variant="body2">{logEntry.message}</Typography>
                <Typography variant="caption">
                  {new Date(logEntry.date).toLocaleString()} -{" "}
                  {logEntry.from ?? "UNKNOW"}
                </Typography>
              </Item>
            ))}

        {showLogsStore && visibleLogsCount < logsStore.logs.length && (
          <Item onPress={loadMoreLogs}>
            <Leading>
              <Plus color={colors.text} size={24} />
            </Leading>
            <Typography variant="title">Charger plus</Typography>
          </Item>
        )}
        <Item
          onPress={() => {
            const accounts = useAccountStore.getState().accounts;
            for (const account of accounts) {
              useAccountStore.getState().removeAccount(account);
            }
            Alert.alert("Success");
          }}
        >
          <Typography variant="title">Reset Account Store</Typography>
        </Item>
      </List>

      <SectionHeader
        title="Notifications"
        leading={
          <Icon>
            <Papicons name="Clock" size={18} />
          </Icon>
        }
      />

      <List>
        <Item
          onPress={() => {
            requestPermissionsAsync();
          }}
        >
          <Typography variant="title">Demander la permission</Typography>
        </Item>
      </List>

      <SectionHeader
        title="Alert"
        leading={
          <Icon>
            <Papicons name="Star" size={18} />
          </Icon>
        }
      />

      <List>
        <Item
          onPress={() =>
            alert.showAlert({
              title: "Connexion impossible",
              description:
                "Il semblerait que ta session a expiré. Tu pourras renouveler ta session dans les paramètres en liant à nouveau ton compte.",
              icon: "AlertTriangle",
              color: "#D60046",
              customButton: {
                label: "Me reconnecter",
                showCancelButton: true,
                onPress: () => {
                  const lastUsedAccount =
                    useAccountStore.getState().lastUsedAccount;
                  const badService = useAccountStore
                    .getState()
                    .accounts.find(account => account.id === lastUsedAccount)
                    ?.services[0];

                  // Unavailable in ED/SKolengo
                  const authUrl =
                    badService?.auth?.additionals?.["instanceURL"] ?? "";
                  setTimeout(() => {
                    router.push({
                      pathname: "/(onboarding)/pronote/webview",
                      params: { url: authUrl, serviceId: badService?.id },
                    });
                  }, 200);
                },
              },
              technical: String(
                " Error: TokenExpiredError at AuthService.validateToken (file:///app/services/auth.js:45:15) at processTicksAndRejections (node:internal/process/task_queues:96:5) at async file:///app/routes/api/user.js:10:28"
              ),
            })
          }
        >
          <Typography variant="title">Error Alert</Typography>
        </Item>
        <Item
          onPress={() => {
            const lastUsedAccount = useAccountStore.getState().lastUsedAccount;
            const badService = useAccountStore
              .getState()
              .accounts.find(account => account.id === lastUsedAccount)
              ?.services[0];
            useAccountStore.getState().updateServiceAuthData(badService!.id, {
              ...badService?.auth,
              refreshToken: "",
            });
          }}
        >
          <Typography variant="title">Clear Auth Data</Typography>
        </Item>
        <Item>
          <Typography variant="title">Activer Alert au Login</Typography>
          <Trailing>
            <NativeSwitch
              value={settingStore.showAlertAtLogin}
              onValueChange={value =>
                mutateProperty("personalization", { showAlertAtLogin: value })
              }
            />
          </Trailing>
        </Item>
      </List>

      <SectionHeader
        title="Session"
        leading={
          <Icon>
            <Papicons name="Star" size={18} />
          </Icon>
        }
      />

      <List>
        <Item
          onPress={async () => {
            await database.write(async () => {
              await database.unsafeResetDatabase();
            });
          }}
        >
          <Typography variant="title">
            Réinitialiser la base de données
          </Typography>
        </Item>
      </List>

      <SectionHeader
        title="Réseau"
        leading={
          <Icon>
            <Papicons name="Globe" size={18} />
          </Icon>
        }
      />
      <List>
        <Item
          onPress={() => {
            const originalFetch = window.fetch;

            window.fetch = async (...args) => {
              const response = await originalFetch(...args);

              const clone = response.clone();
              const data = await clone.text();

              const rawUrl = args[0];

              const url = rawUrl instanceof URL
                ? rawUrl
                : new URL(typeof rawUrl === "string" ? rawUrl : String(rawUrl));

              useNetworkStore().addItem({
                url,
                method: args[1]?.method ?? "GET",
              });
              
              return response;
            };
          }}
        >
          <Typography variant="title">Appliquer le MonkeyPatch</Typography>
        </Item>
        <Item
          onPress={() => {
            fetch("https://exemple.org")
          }}
        >
          <Typography variant="title">Faire une requête (GET)</Typography>
        </Item>
      </List>

      <SectionHeader
        title="Notifications"
        leading={
          <Icon>
            <Papicons name="Clock" size={18} />
          </Icon>
        }
      />

      <List>
        <Item
          onPress={() => {
            requestPermissionsAsync();
          }}
        >
          <Typography variant="title">Demander la permission</Typography>
        </Item>
        <Item
          onPress={async () => {
            const date = new Date(Date.now() + 5000);

            const id = await scheduleNotificationAtDate(
              "Aether",
              "Une notification programmée via Aether arrive à l'instant!",
              date
            );

            Alert.alert("Une notification arrive dans 5 sec", `ID : ${id}`);
          }}
        >
          <Typography variant="title">Programmer une notification</Typography>
        </Item>
      </List>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  containerContent: {},
});
