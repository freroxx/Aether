import { useRoute, useTheme } from "expo-router/react-navigation";
import { router, useNavigation } from "expo-router";
import React, { createRef, RefObject, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, KeyboardAvoidingView } from "react-native";
import Reanimated, { FadeIn, FadeOut } from "react-native-reanimated";
import { formatSchoolName } from '@/utils/format/formatSchoolName';
import WebView from "react-native-webview";
import { WebViewErrorEvent, WebViewMessage, WebViewNavigationEvent } from "react-native-webview/lib/WebViewTypes";

import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { PronoteApiClient } from "@/services/pronote/api-client";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import Stack from "@/ui/components/Stack";
import Divider from "@/ui/new/Divider";
import Typography from "@/ui/new/Typography";
import { URLToBase64 } from "@/utils/attachments/helper";
import { GetIdentityFromPronoteUsername } from "@/utils/pronote/name";
import uuid from "@/utils/uuid/uuid";

import OnboardingWebView from "../../components/OnboardingWebView";
import Button from "@/ui/new/Button";

export default function PronoteENTLogin() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { params } = useRoute<any>();
  const { url: rawUrl = "", school, accountType = "eleve" } = (params as any) || {};

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
  console.log("WebViewScreen initialized with URL:", url, "as", accountType);

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
    console.log("Message received from WebView:", message);

    if (message.type === "pronote.connectionError") {
      setBrowserVisible(true);
      if (!hasShownConnectionErrorAlert) {
        setHasShownConnectionErrorAlert(true);
        Alert.alert("Connexion impossible", "La connexion à Pronote est impossible. Cele vient probablement de votre établissement ou d'une erreur de configuration.");
      }
      return;
    }

    if (received) { return; }

    if (message.type === "pronote.loginState") {
      console.log("Login state message received:", message.data);

      if (!message.data) {
        console.warn("No login data in message");
        return;
      }
      if (message.data.status !== 0) {
        console.warn("Login status is not valid:", message.data.status);
        return;
      }
      setReceived(true);

      console.log(message.data.login, message.data.mdp);
      console.log("Connecting via PronoteApiClient.tokenLogin...");
      try {
        const res = await PronoteApiClient.tokenLogin(
          url,
          message.data.login,
          message.data.mdp,
          deviceUUID,
          isParent ? "parent" : "eleve"
        );

        if (!res.success) {
          throw new Error("Erreur lors de la connexion");
        }

        console.log("Login successful, adding account to store...");
        const schoolName = res.user?.establishment || (school && school.name ? school.name : "Pronote");
        const className = res.user?.class_name || "";
        const { firstName, lastName } = GetIdentityFromPronoteUsername(res.user?.name || message.data.login);
        const finalIsParent = res.user?.account_type === "parent" || (res.children && res.children.length > 0);
        const finalAccountType = finalIsParent ? "parent" : "eleve";
        const children = res.children || [];
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
              additionals: {
                instanceURL: url,
                username: message.data.login,
                deviceUUID,
                authToken: res.auth_token,
                accountType: finalAccountType,
              },
            },
            serviceId: Services.PRONOTE,
            createdAt: (new Date()).toISOString(),
            updatedAt: (new Date()).toISOString(),
          }],
          createdAt: (new Date()).toISOString(),
          updatedAt: (new Date()).toISOString(),
        });
        useAccountStore.getState().setLastUsedAccount(deviceUUID);

        router.dismissAll();
        return router.replace("/(tabs)/index");
      } catch (error: any) {
        console.error("Error during login:", error);
        Alert.alert("Erreur", error?.message || "Une erreur est survenue lors de la connexion à Pronote. Veuillez réessayer.");
      }
    }
  };

  const onWebviewLoadEnd = (e: WebViewNavigationEvent | WebViewErrorEvent) => {
    const { url } = e.nativeEvent;
    console.log("WebView finished loading URL:", url);

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
      console.log("Injecting JSON script for InfoMobileURL");
      webViewRef.current?.injectJavaScript(INJECT_PRONOTE_JSON);
    } else if (url.includes("mobile.eleve.html") || url.includes("mobile.parent.html")) {
      console.log("Injecting login state scripts for account type:", isParent ? "parent" : "eleve");
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
