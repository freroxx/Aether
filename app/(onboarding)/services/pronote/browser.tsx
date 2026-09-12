import { useRoute, useTheme } from "expo-router/react-navigation";
import { router, useNavigation } from "expo-router";
import React, { createRef, RefObject, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView } from "react-native";
import Reanimated, { FadeIn, FadeOut } from "react-native-reanimated";
import { formatSchoolName } from '@/utils/format/formatSchoolName';
import WebView from "react-native-webview";
import { WebViewErrorEvent, WebViewMessage, WebViewNavigationEvent } from "react-native-webview/lib/WebViewTypes";

import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { PronoteApiClient } from "@/services/pronote/api-client";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import { useAlert } from "@/ui/components/AlertProvider";
import Stack from "@/ui/components/Stack";
import Divider from "@/ui/new/Divider";
import Typography from "@/ui/new/Typography";
import { GetIdentityFromPronoteUsername } from "@/utils/pronote/name";
import uuid from "@/utils/uuid/uuid";
import {
  buildPronoteAdditionals,
  isMfaRequiredError,
  normalizeChildren,
} from "./postLogin";

import OnboardingWebView from "../../components/OnboardingWebView";
import Button from "@/ui/new/Button";

export default function PronoteENTLogin() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { params } = useRoute<any>();
  const { url: rawUrl = "", school, accountType = "eleve", accountPin, deviceName, clientIdentifier } = (params as any) || {};

  // Normalize: strip query/hash, then extract the base Pronote URL by removing any .html filename and trailing slashes.
  // Note: credentials.tsx provides a direct identifiant/mot de passe fallback (pronotepy Client) when ENT WebView login fails.
  // The direct-login URL is base + targetHtml (appended at usage since base never ends with .html here).
  const url = (rawUrl || "")
    .split("?")[0].split("#")[0]
    .replace(/\/(?:eleve|parent|mobile\.(?:eleve|parent))\.html$/, "")
    .replace(/\/+$/, "");

  const isParent = accountType === "parent";
  const targetHtml = isParent ? "mobile.parent.html" : "mobile.eleve.html";
  const baseURL = url.split("/pronote")[0] || "";

  // UI Logic
  const [browserVisible, setBrowserVisible] = React.useState(false);

  const [hasLoadingBeenTooLong, setHasLoadingBeenTooLong] = useState(false);
  const [loadingHidden, setLoadingHidden] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, []);

  useEffect(() => {
    if (browserVisible) {
      setHasLoadingBeenTooLong(false);
      return;
    }

    const timeout = setTimeout(() => {
      setHasLoadingBeenTooLong(true);
    }, 15000);

    return () => clearTimeout(timeout);
  }, [browserVisible]);

  const webViewRef: RefObject<WebView<{}> | null> = createRef<WebView>();

  // Login logic
  const infoMobileURL = url + "/InfoMobileApp.json?id=0D264427-EEFC-4810-A9E9-346942A862A4";

  const [deviceUUID] = useState(uuid());
  const [received, setReceived] = useState<boolean>(false);
  const alert = useAlert();

  const [hasShownConnectionErrorAlert, setHasShownConnectionErrorAlert] = useState(false);

  const PRONOTE_COOKIE_EXPIRED = new Date(0).toUTCString();
  const PRONOTE_COOKIE_VALIDATION_EXPIRES = new Date(
    new Date().getTime() + 5 * 60 * 1000,
  ).toUTCString();
  const PRONOTE_COOKIE_LANGUAGE_EXPIRES = new Date(
    new Date().getTime() + 365 * 24 * 60 * 60 * 1000,
  ).toUTCString();

  const INJECT_PRONOTE_HOOK_DEFINITION = `
    window.hookAccesDepuisAppli = function() {
      this.passerEnModeValidationAppliMobile('', '${deviceUUID}');
    };
    true;
    `.trim();

  const INJECT_PRONOTE_INITIAL_LOGIN_HOOK = `
    window.hookAccesDepuisAppli = function() {
      this.passerEnModeValidationAppliMobile('', '${deviceUUID}');
    };
    try {
          window.GInterface.passerEnModeValidationAppliMobile('', '${deviceUUID}', '', '', '{"model": "random", "platform": "android"}');
    } catch (e) {
    }
    `.trim();

  const INJECT_PRONOTE_JSON = `
      (function () {
        try {
          const json = JSON.parse(document.body.innerText);
          const lJetonCas = !!json && !!json.CAS && json.CAS.jetonCAS;
          
          if (!!lJetonCas) {
            document.cookie = "appliMobile=; expires=${PRONOTE_COOKIE_EXPIRED}";
            document.cookie = "validationAppliMobile=" + lJetonCas + "; expires=${PRONOTE_COOKIE_VALIDATION_EXPIRES}";
            document.cookie = "uuidAppliMobile=${deviceUUID}; expires=${PRONOTE_COOKIE_VALIDATION_EXPIRES}";
            // 1036 = French
            document.cookie = "ielang=1036; expires=${PRONOTE_COOKIE_LANGUAGE_EXPIRES}";
          } else {
            document.cookie = "appliMobile=1; expires=${PRONOTE_COOKIE_VALIDATION_EXPIRES}";
            document.cookie = "ielang=1036; expires=${PRONOTE_COOKIE_LANGUAGE_EXPIRES}";
          }

          window.location.assign("${url}/${targetHtml}?fd=1");
        }
        catch (error) {

        }
      })();
    `.trim();

  const INJECT_PRONOTE_CURRENT_LOGIN_STATE = `
    (function () {
      setInterval(function() {
        const state = window && window.loginState ? window.loginState : void 0;

        if (!state) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'debug.state',
            data: {
              url: window.location.href,
              cookie: document.cookie,
              hasGInterface: typeof window.GInterface,
              candidates: Object.keys(window).filter(function (k) {
                return /login|GInterface|Etat|Mobile|Appli/i.test(k);
              }).slice(0, 40)
            }
          }));
        }

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pronote.loginState',
          data: state
        }));
      }, 1000);
    })();
    `.trim();

  const INJECT_PRONOTE_CONNECTION_ERROR_WATCHER = `
    (function () {
      if (window.__pronoteConnImpossibleWatcherInstalled) return;
      window.__pronoteConnImpossibleWatcherInstalled = true;

      function hasConnectionError() {
        const nodes = document.querySelectorAll('div');
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i];
          const raw = node && node.textContent ? node.textContent : "";
          const text = raw
            .normalize("NFD")
            .replace(/[\\u0300-\\u036f]/g, "")
            .toLowerCase()
            .trim();

          if (!text) continue;
          if (text.includes("connexion impossible") || text.includes("erreur")) {
            return true;
          }
        }

        return false;
      }

      function notifyIfNeeded() {
        if (window.__pronoteConnImpossibleSent) return;
        if (!hasConnectionError()) return;
        window.__pronoteConnImpossibleSent = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pronote.connectionError'
        }));
      }

      notifyIfNeeded();
      setInterval(notifyIfNeeded, 1000);

      const observer = new MutationObserver(notifyIfNeeded);
      observer.observe(document.documentElement || document.body, { childList: true, subtree: true, characterData: true });
    })();
    `.trim();

  const onWebviewMessage = async ({ nativeEvent }: { nativeEvent: WebViewMessage }) => {
    let message: { type?: string; data?: any };
    try {
      message = JSON.parse(nativeEvent.data);
    } catch {
      return;
    }

    if (message.type === "pronote.connectionError") {
      setBrowserVisible(true);
      if (!hasShownConnectionErrorAlert) {
        setHasShownConnectionErrorAlert(true);
        alert.showAlert({
          title: "Connexion impossible",
          description: "La connexion à Pronote est impossible. Cela vient probablement de ton établissement ou d'une erreur de configuration.",
          icon: "WifiOff",
          color: "#E05D34",
        });
      }
      return;
    }

    if (received) { return; }

    if (message.type === "pronote.loginState") {
      if (!message.data) {
        return;
      }
      if (message.data.status !== 0) {
        return;
      }
      setReceived(true);
      try {
        const mfa =
          accountPin || deviceName || clientIdentifier
            ? {
                ...(typeof accountPin === "string" && accountPin ? { accountPin } : {}),
                ...(typeof deviceName === "string" && deviceName ? { deviceName } : {}),
                ...(typeof clientIdentifier === "string" && clientIdentifier
                  ? { clientIdentifier }
                  : {}),
              }
            : undefined;
        const res = await PronoteApiClient.tokenLogin(
          url,
          message.data.login,
          message.data.mdp,
          deviceUUID,
          isParent ? "parent" : "eleve",
          mfa
        );

        if (!res.success) {
          throw new Error("Erreur lors de la connexion");
        }

        const schoolName = res.user?.establishment || (school && school.name ? school.name : "Pronote");
        const className = res.user?.class_name || "";
        const { firstName, lastName } = GetIdentityFromPronoteUsername(res.user?.name || message.data.login);
        const finalIsParent = res.user?.account_type === "parent" || (res.children && res.children.length > 0);
        const finalAccountType = finalIsParent ? "parent" : "eleve";
        const children = normalizeChildren(res.children);
        const selectedChild = children.length > 0 ? children[0].name : undefined;

        useAccountStore.getState().addAccount({
          id: deviceUUID,
          firstName,
          lastName,
          schoolName,
          className,
          accountType: finalAccountType,
          children,
          selectedChild,
          customisation: {
            profilePicture: "",
            subjects: {}
          },
          services: [{
            id: deviceUUID,
            auth: {
              accessToken: res.auth_token,
              refreshToken: res.auth_token,
              additionals: buildPronoteAdditionals(
                {
                  instanceURL: url,
                  url,
                  username: message.data.login,
                  deviceUUID,
                  uuid: deviceUUID,
                  // Token BRUT (mot de passe de session Pronote) : indispensable au
                  // refresh /auth/token. Le blob auth_token seul serait rejeté.
                  // Stocké aussi comme `password` : si le token est rejeté, le
                  // refresh bascule dessus (les routes data rejouent
                  // username+password via le backend).
                  token: message.data.mdp,
                  password: message.data.mdp,
                  authToken: res.auth_token,
                  auth_token: res.auth_token,
                  accountType: finalAccountType,
                  account_type: finalAccountType,
                },
                res,
                mfa,
                message.data.mdp,
                deviceUUID
              ),
            },
            serviceId: Services.PRONOTE,
            createdAt: (new Date()).toISOString(),
            updatedAt: (new Date()).toISOString(),
          }],
          createdAt: (new Date()).toISOString(),
          updatedAt: (new Date()).toISOString(),
        });
        useAccountStore.getState().setLastUsedAccount(deviceUUID);

        try {
          const { initAccountAfterLogin } = await import("./postLogin");
          initAccountAfterLogin(deviceUUID).catch(() => {});
        } catch {
          // synchro de fond sur l'accueil
        }
        const { finishAuthNavigation } = await import("@/utils/navigation/finishAuth");
        finishAuthNavigation();
        return;
      } catch (error: any) {
        // 428 MFAError : bascule vers l'écran 2FA en conservant le jeton ENT.
        if (isMfaRequiredError(error) && message?.data?.login && message?.data?.mdp) {
          setReceived(false);
          router.push({
            pathname: "/(onboarding)/services/pronote/2fa",
            params: {
              mode: "token",
              url,
              username: String(message.data.login),
              token: String(message.data.mdp),
              uuid: deviceUUID,
              accountType: isParent ? "parent" : "eleve",
              ...(typeof clientIdentifier === "string" && clientIdentifier
                ? { clientIdentifier }
                : {}),
            },
          } as any);
          return;
        }
        alert.showAlert({
          title: "Erreur",
          description: error?.message || "Une erreur est survenue lors de la connexion à Pronote. Veuillez réessayer.",
          icon: "AlertTriangle",
          color: "#E05D34",
        });
      }
    }
  };

  const onWebviewLoadEnd = (e: WebViewNavigationEvent | WebViewErrorEvent) => {
    const { url } = e.nativeEvent;

    if (url === infoMobileURL) {
      setBrowserVisible(false);
    } else {
      setBrowserVisible(true);
    }

    webViewRef.current?.injectJavaScript(
      INJECT_PRONOTE_INITIAL_LOGIN_HOOK,
    );

    if (url.startsWith(baseURL)) {
      webViewRef.current?.injectJavaScript(
        INJECT_PRONOTE_CONNECTION_ERROR_WATCHER,
      );
    }

    if (url === infoMobileURL) {
      webViewRef.current?.injectJavaScript(INJECT_PRONOTE_JSON);
    } else if (url.includes("mobile.eleve.html") || url.includes("mobile.parent.html")) {
      webViewRef.current?.injectJavaScript(
        INJECT_PRONOTE_INITIAL_LOGIN_HOOK,
      );
      webViewRef.current?.injectJavaScript(
        INJECT_PRONOTE_CURRENT_LOGIN_STATE,
      );
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={20}>
      {!browserVisible && !loadingHidden &&
        <Reanimated.View
          style={{
            height: "100%",
            width: "100%",
            position: "absolute",
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          entering={FadeIn.duration(130)}
          exiting={FadeOut.duration(130)}
        >
          <Stack vAlign="center" hAlign="center" width={"100%"} gap={3} padding={20}>
            <ActivityIndicator />
            <Divider height={12} ghost />
            <Typography align="center" variant="h4">{t("ONBOARDING_LOGIN_TO")} {school && school.name ? formatSchoolName(school.name) : t("ONBOARDING_YOUR_SCHOOL")}</Typography>
            <Typography align="center" variant="body" color="textSecondary">{t("ONBOARDING_SCHOOLS_SEARCHING_HINT")}</Typography>

            {hasLoadingBeenTooLong && (
              <Button label="Masquer" variant="text" onPress={() => setLoadingHidden(true)} />
            )}
          </Stack>
        </Reanimated.View>
      }

      <OnboardingWebView
        source={{ uri: infoMobileURL }}
        webViewRef={webViewRef}
        incognito={true}
        userAgent="Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
        onMessage={onWebviewMessage}
        onLoadEnd={onWebviewLoadEnd}
        injectedJavaScriptBeforeContentLoaded={INJECT_PRONOTE_HOOK_DEFINITION}
        startInLoadingState
        onOpenWindow={(evt) => {
          webViewRef.current?.stopLoading();
          webViewRef.current?.injectJavaScript(`window.location.assign("${evt.nativeEvent.targetUrl}");`); // Yes, this is tricky, but it's in official documentation
        }}
        injectedJavaScript={`
        var meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        document.getElementsByTagName('head')[0].appendChild(meta);
        `}
      />
    </KeyboardAvoidingView>
  )
}
