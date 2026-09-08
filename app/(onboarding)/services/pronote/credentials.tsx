import { useHeaderHeight, useRoute, useTheme } from "expo-router/react-navigation";
import { router, useNavigation } from "expo-router";
import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, KeyboardAvoidingView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatSchoolName } from "@/utils/format/formatSchoolName";

import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { PronoteApiClient } from "@/services/pronote/api-client";
import Stack from "@/ui/components/Stack";
import Button from "@/ui/new/Button";
import Divider from "@/ui/new/Divider";
import List from "@/ui/new/List";
import TextInput from "@/ui/new/TextInput";
import Typography from "@/ui/new/Typography";
import { GetIdentityFromPronoteUsername } from "@/utils/pronote/name";
import uuid from "@/utils/uuid/uuid";

export type PronoteCredentialsAccountType = "eleve" | "parent";

/**
 * Normalize a user-provided Pronote URL into a direct login URL.
 * pronotepy `Client(pronote_url, ...)` requires a direct URL ending in
 * `eleve.html` / `parent.html` (e.g. `.../pronote/eleve.html`), without
 * any query string or hash fragment.
 */
export function normalizePronoteUrl(raw: string, accountType: PronoteCredentialsAccountType = "eleve"): string {
  // pronotepy requires direct URL ending eleve.html/parent.html, no query — strip query/hash,
  // strip any existing eleve/parent/mobile entry point, then re-append per account type.
  const baseUrl = (raw || "").trim().split("?")[0].split("#")[0].replace(/\/(?:eleve|parent|mobile\.(?:eleve|parent))\.html$/i, "").replace(/\/+$/, "");
  const isParentAccount = accountType === "parent";
  return `${baseUrl}/${isParentAccount ? "parent.html" : "eleve.html"}`;
}

const PronoteCredentialsForm = memo(({
  baseUrl,
  schoolName,
  accountType,
}: {
  baseUrl: string;
  schoolName: string;
  accountType: PronoteCredentialsAccountType;
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [ent, setEnt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isParent = accountType === "parent";
  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading;

  const submit = async () => {
    if (!canSubmit) { return; }
    if (!baseUrl.trim()) {
      const message = "URL PRONOTE manquante. Veuillez resélectionner votre établissement.";
      setError(message);
      Alert.alert("Erreur", message);
      return;
    }
    setLoading(true);
    setError(null);

    const accountID = uuid();

    try {
      const normalized = normalizePronoteUrl(baseUrl, isParent ? "parent" : "eleve");

      const res = await PronoteApiClient.directLogin(
        normalized,
        username.trim(),
        password,
        ent.trim() || undefined,
        isParent ? "parent" : "eleve"
      );

      if (!res.success) {
        throw new Error("Échec de connexion");
      }

      const { firstName, lastName } = GetIdentityFromPronoteUsername(res.user?.name || username.trim());
      const finalSchoolName = res.user?.establishment || schoolName || "Pronote";
      const className = res.user?.class_name || "";
      const finalIsParent = res.user?.account_type === "parent" || (res.children && res.children.length > 0);
      const finalAccountType = finalIsParent ? "parent" : "eleve";
      const children = res.children || [];
      const selectedChild = children.length > 0 ? children[0].name : undefined;

      useAccountStore.getState().addAccount({
        id: accountID,
        firstName,
        lastName,
        schoolName: finalSchoolName,
        className,
        accountType: finalAccountType,
        children,
        selectedChild,
        customisation: {
          profilePicture: "",
          subjects: {}
        },
        services: [{
          id: accountID,
          auth: {
            accessToken: res.auth_token,
            refreshToken: res.auth_token,
            additionals: {
              instanceURL: normalized,
              url: normalized,
              username: username.trim(),
              deviceUUID: accountID,
              uuid: accountID,
              // Identifiants bruts : le login direct n'a pas de token rotatif,
              // les routes data rejouent username+password via le backend.
              password,
              ...(ent.trim() ? { ent: ent.trim() } : {}),
              authToken: res.auth_token,
              accountType: finalAccountType,
              account_type: finalAccountType,
            }
          },
          serviceId: Services.PRONOTE,
          createdAt: (new Date()).toISOString(),
          updatedAt: (new Date()).toISOString()
        }],
        createdAt: (new Date()).toISOString(),
        updatedAt: (new Date()).toISOString()
      });
      useAccountStore.getState().setLastUsedAccount(accountID);

      router.dismissAll();
      return router.replace("/(tabs)/index");
    } catch (e: any) {
      const message = e?.message || "Identifiants incorrects. Vérifie ton identifiant et ton mot de passe.";
      setError(message);
      Alert.alert("Erreur de connexion", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack padding={[4, 0]}>
      <Typography variant="h2">{formatSchoolName(schoolName || baseUrl)}</Typography>
      <View
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: String(colors.primary) + "1A",
        }}
      >
        <Typography variant="caption" color="primary">{isParent ? "Parent" : "Élève"}</Typography>
      </View>
      <Typography variant="action" color="textSecondary">{t("ONBOARDING_LOGIN_CREDENTIALS")}</Typography>
      <Divider height={6} ghost />
      <TextInput
        color={colors.primary}
        placeholder={t("INPUT_USERNAME")}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        textContentType="username"
      />
      <Divider height={3} ghost />
      <TextInput
        color={colors.primary}
        placeholder={t("INPUT_PASSWORD")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        returnKeyType="next"
        textContentType="password"
      />
      <Divider height={3} ghost />
      <TextInput
        color={colors.primary}
        placeholder="ENT (optionnel)"
        value={ent}
        onChangeText={setEnt}
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
        label={loading ? t("ONBOARDING_LOADING_LOGIN") : t("LOGIN_BTN")}
        fullWidth
        height={44}
        onPress={submit}
        disabled={!canSubmit}
      />
      <Divider height={18} ghost />
    </Stack>
  );
});

export default function PronoteLoginCredentials() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { url = "", school, accountType = "eleve" } = (route.params as any) || {};
  const schoolName = typeof school === "string" ? school : (school?.name || "");

  React.useEffect(() => {
    navigation.setOptions({
      headerTitle: schoolName ? formatSchoolName(schoolName) : t("ONBOARDING_LOGIN_CREDENTIALS"),
    });
  }, [navigation, schoolName, t]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={20}>
      <List
        ListHeaderComponent={
          <PronoteCredentialsForm
            baseUrl={url}
            schoolName={schoolName}
            accountType={accountType}
          />
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
