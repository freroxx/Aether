import { useHeaderHeight, useRoute, useTheme } from "expo-router/react-navigation";
import { useNavigation } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatSchoolName } from "@/utils/format/formatSchoolName";

import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { PronoteApiClient } from "@/services/pronote/api-client";
import Stack from "@/ui/components/Stack";
import { useAlert } from "@/ui/components/AlertProvider";
import Button from "@/ui/new/Button";
import Divider from "@/ui/new/Divider";
import List from "@/ui/new/List";
import TextInput from "@/ui/new/TextInput";
import Typography from "@/ui/new/Typography";
import { GetIdentityFromPronoteUsername } from "@/utils/pronote/name";
import { isUnknownEntError, describeEntError } from "@/utils/pronote/ents";
import { error as logError } from "@/utils/logger/logger";
import { hapticFor } from "@/utils/haptics";
import uuid from "@/utils/uuid/uuid";
import {
  buildPronoteAdditionals,
  isExpiredQrError,
  isMfaRequiredError,
  isQrDecryptError,
  normalizeChildren,
  persistMfaAuthData,
} from "./postLogin";

export type Pronote2FAMode = "direct" | "qrcode" | "token";

function describeMfaError(e: unknown): string {
  const raw = String((e as any)?.detail || (e as any)?.message || e || "");
  const low = raw.toLowerCase();
  if (isUnknownEntError(e)) return raw;
  if (isMfaRequiredError(e)) {
    return (
      "Pronote demande encore une validation : vérifie le code PIN à 4 chiffres " +
      "(Profil Pronote > Double authentification) et le nom d'appareil, puis réessaie."
    );
  }
  // PIN incorrect (QR indéchiffrable) ≠ QR expiré : messages distincts.
  if (isQrDecryptError(e)) {
    return "Code PIN incorrect (QR indéchiffrable). Vérifie les 4 chiffres affichés dans Pronote.";
  }
  if (
    isExpiredQrError(e) ||
    low.includes("jeton") ||
    low.includes("token") ||
    low.includes("session")
  ) {
    return "QR Code expiré ou déjà utilisé. Génère un nouveau QR Code dans Pronote (Profil > QR Code).";
  }
  if (low.includes("404") || low.includes("not found") || low.includes("serveur api")) {
    return "Serveur API Aether injoignable (404). Vérifie l'URL dans Personnalisation > Serveur API Pronote ou redéploie le backend, puis réessaie.";
  }
  if (low.includes("network") || low.includes("timeout") || low.includes("504") || low.includes("502")) {
    return "Serveur Pronote injoignable. Vérifie ta connexion puis réessaie.";
  }
  return raw || "Échec de la double authentification. Vérifie le code PIN puis réessaie.";
}

async function finishLoginFlow(accountID: string, alert: ReturnType<typeof useAlert>) {
  try {
    const { initAccountAfterLogin } = await import("./postLogin");
    await initAccountAfterLogin(accountID);
  } catch (e) {
    logError("2FA post-login init failed: " + String(e), "2fa.finishLoginFlow");
    const { describeInitError } = await import("./postLogin");
    alert.showAlert({
      title: "Synchronisation impossible",
      description:
        "Session créée, mais la première synchronisation a échoué : " + describeInitError(e),
      icon: "Refresh",
      color: "#E05D34",
    });
    return;
  }
  const { finishAuthNavigation } = await import("@/utils/navigation/finishAuth");
  finishAuthNavigation();
}

/**
 * Écran 2FA réel : le backend renvoie 428 (MFAError pronotepy) quand le compte
 * exige un code PIN d'appareil. On rejoue le login avec `account_pin` +
 * `device_name` (+ `client_identifier` si déjà connu), puis on persiste
 * account_pin/client_identifier/device_name via updateServiceAuthData.
 *
 * Params route (tout strings, qrData = JSON sérialisé) :
 *   mode, accountId?, url?, username?, password?, ent?, accountType?,
 *   qrData?, pin?, uuid?, token?, clientIdentifier?, schoolName?
 */
export function Pronote2FAModal({ setChallengeModalVisible }: { setChallengeModalVisible?: (visible: boolean) => void }) {
  void setChallengeModalVisible;
  return <Pronote2FAScreen />;
}

export default function Pronote2FAScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const alert = useAlert();

  const params = (route.params as any) || {};
  const mode = (params.mode as Pronote2FAMode) || "direct";
  const accountIdParam: string | undefined = params.accountId;
  const accountType: "eleve" | "parent" = params.accountType === "parent" ? "parent" : "eleve";
  const schoolName: string = typeof params.schoolName === "string" ? params.schoolName : "";

  const [accountPin, setAccountPin] = React.useState("");
  const [deviceName, setDeviceName] = React.useState("Aether");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    navigation.setOptions({ headerTitle: t("ONBOARDING_HEADER_QRCODE_LOGIN") as string });
  }, [navigation, t]);

  const pinValid = /^\d{4}$/.test(accountPin.trim());
  const canSubmit = pinValid && deviceName.trim().length > 0 && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const pin = accountPin.trim();
    const name = deviceName.trim() || "Aether";
    const mfa = {
      accountPin: pin,
      deviceName: name,
      ...(typeof params.clientIdentifier === "string" && params.clientIdentifier
        ? { clientIdentifier: params.clientIdentifier }
        : {}),
    };

    try {
      let res: Awaited<ReturnType<typeof PronoteApiClient.directLogin>>;
      if (mode === "qrcode") {
        const qrData =
          typeof params.qrData === "string" ? JSON.parse(params.qrData) : params.qrData;
        const qrPin: string = params.pin || "";
        const qrUuid: string = params.uuid || "";
        if (!qrData || !qrPin || !qrUuid) {
          throw new Error("Données QR manquantes. Reprends la connexion depuis le QR Code.");
        }
        res = await PronoteApiClient.qrCodeLogin(qrData, qrPin, qrUuid, accountType, mfa);
      } else if (mode === "token") {
        if (!params.url || !params.username || !params.token || !params.uuid) {
          throw new Error("Session ENT incomplète. Reprends la connexion depuis l'ENT.");
        }
        res = await PronoteApiClient.tokenLogin(
          String(params.url),
          String(params.username),
          String(params.token),
          String(params.uuid),
          accountType,
          mfa
        );
      } else {
        if (!params.url || !params.username || !params.password) {
          throw new Error("Identifiants manquants. Reprends la connexion depuis l'écran précédent.");
        }
        res = await PronoteApiClient.directLogin(
          String(params.url),
          String(params.username),
          String(params.password),
          params.ent ? String(params.ent) : undefined,
          accountType,
          mfa
        );
      }

      if (!res.success) throw new Error("Échec de la double authentification");

      // Compte déjà créé par l'écran précédent : on met à jour son auth.
      if (accountIdParam) {
        persistMfaAuthData(accountIdParam, res, mfa);
        await hapticFor("success");
        await finishLoginFlow(accountIdParam, alert);
        return;
      }

      // Sinon création du compte (même schéma que credentials/qrcode/browser).
      const accountID = uuid();
      const { getDeviceUuid } = await import("./postLogin");
      const deviceUuid: string = params.uuid || getDeviceUuid();
      const rawCreds = (res.credentials ?? {}) as Record<string, any>;
      const loginName: string = params.username || res.user?.name || "";
      const { firstName, lastName } = GetIdentityFromPronoteUsername(res.user?.name || loginName);
      const finalSchoolName = res.user?.establishment || schoolName || "Pronote";
      const className = res.user?.class_name || "";
      const finalIsParent =
        res.user?.account_type === "parent" || (res.children && res.children.length > 0);
      const finalAccountType = finalIsParent ? "parent" : "eleve";
      const children = normalizeChildren(res.children);
      const selectedChild = children.length > 0 ? children[0].name : undefined;
      const rawToken =
        rawCreds.token || (mode === "token" ? params.token : undefined) || params.password;
      const rawUrl = rawCreds.url || params.url;
      const rawUsername = rawCreds.username || loginName;

      useAccountStore.getState().addAccount({
        id: accountID,
        firstName,
        lastName,
        schoolName: finalSchoolName,
        className,
        accountType: finalAccountType,
        children,
        selectedChild,
        customisation: { profilePicture: "", subjects: {} },
        services: [
          {
            id: accountID,
            auth: {
              accessToken: res.auth_token,
              refreshToken: res.auth_token,
              additionals: buildPronoteAdditionals(
                {
                  instanceURL: rawUrl,
                  url: rawUrl,
                  username: rawUsername,
                  deviceUUID: deviceUuid,
                  uuid: rawCreds.uuid || deviceUuid,
                  authToken: res.auth_token,
                  auth_token: res.auth_token,
                  accountType: finalAccountType,
                  account_type: finalAccountType,
                  ...(mode === "direct" && params.password ? { password: params.password } : {}),
                  ...(mode === "token" && params.token
                    ? { password: rawToken, token: rawToken }
                    : {}),
                  ...(params.ent ? { ent: params.ent } : {}),
                },
                res,
                mfa,
                rawToken,
                rawCreds.uuid || deviceUuid
              ),
            },
            serviceId: Services.PRONOTE,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      useAccountStore.getState().setLastUsedAccount(accountID);
      await hapticFor("success");
      await finishLoginFlow(accountID, alert);
    } catch (e: any) {
      logError("2FA login failed: " + String(e?.message || e), "2fa.submit");
      let message = describeMfaError(e);
      if (isUnknownEntError(e) && params.ent) message = describeEntError(String(params.ent));
      setError(message);
      await hapticFor("error");
      alert.showAlert({ title: "Double authentification", description: message, icon: "Shield", color: "#E05D34" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={20}>
      <List
        ListHeaderComponent={
          <Stack padding={[4, 0]}>
            <Typography variant="h2">Double authentification</Typography>
            <Typography variant="action" color="textSecondary">
              {formatSchoolName(schoolName) || "Pronote a exigé une validation d'appareil (erreur 428 / MFAError)."}
            </Typography>
            <Divider height={6} ghost />
            <Typography variant="body1" color="textSecondary">
              Saisis le code PIN à 4 chiffres de la double authentification (Pronote {">"} Profil {">"} Double
              authentification) et le nom de l'appareil à enregistrer. Ils seront réutilisés
              automatiquement aux prochaines connexions.
            </Typography>
            <Divider height={6} ghost />
            <TextInput
              color={colors.primary}
              placeholder="Code PIN à 4 chiffres"
              value={accountPin}
              onChangeText={(v: string) => setAccountPin(v.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              returnKeyType="next"
            />
            <Divider height={3} ghost />
            <TextInput
              color={colors.primary}
              placeholder="Nom de l'appareil (ex. Aether)"
              value={deviceName}
              onChangeText={setDeviceName}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            {error && (
              <>
                <Divider height={3} ghost />
                <Typography variant="body1" color="danger">{error}</Typography>
              </>
            )}
            <Divider height={3} ghost />
            <Button
              label={loading ? t("ONBOARDING_LOADING_LOGIN") : "Valider la double authentification"}
              fullWidth
              height={44}
              onPress={submit}
              disabled={!canSubmit}
            />
            <Divider height={18} ghost />
            <View style={{ alignItems: "center" }}>
              <Typography variant="caption" color="textSecondary" style={{ textAlign: "center" }}>
                Le PIN reste stocké avec le compte (account_pin) avec l'identifiant d'appareil
                (client_identifier) renvoyé par Pronote.
              </Typography>
            </View>
          </Stack>
        }
        contentContainerStyle={{
          padding: 16,
          flexGrow: 1,
          gap: 10,
          paddingTop: headerHeight + 20,
          paddingBottom: insets.bottom + 20,
        }}
        style={{ flex: 1 }}
        animated
      >
        {null}
      </List>
    </KeyboardAvoidingView>
  );
}
