import { Papicons } from "@getpapillon/papicons";
import MaskedView from "@react-native-masked-view/masked-view";
import { useTheme, useRoute } from "expo-router/react-navigation";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Reanimated, {
  FadeInUp,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { PronoteApiClient } from "@/services/pronote/api-client";
import Button from "@/ui/components/Button";
import { useAlert } from "@/ui/components/AlertProvider";
import Icon from "@/ui/components/Icon";
import Typography from "@/ui/components/Typography";
import { GetIdentityFromPronoteUsername } from "@/utils/pronote/name";
import { error as logError } from "@/utils/logger/logger";
import { hapticFor } from "@/utils/haptics";
import uuid from "@/utils/uuid/uuid";

function describeQRError(e: unknown): string {
  const msg = String((e as any)?.message || e || "").toLowerCase();
  if (msg.includes("pin") || msg.includes("code")) {
    return "Code PIN incorrect. Vérifie les 4 chiffres affichés dans Pronote.";
  }
  if (
    msg.includes("expir") ||
    msg.includes("jeton") ||
    msg.includes("token") ||
    msg.includes("datasec")
  ) {
    return "QR Code expiré ou déjà utilisé. Génère un nouveau QR Code dans Pronote (Profil > QR Code).";
  }
  if (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("injoignable") ||
    msg.includes("504") ||
    msg.includes("502")
  ) {
    return "Serveur Pronote injoignable. Vérifie ta connexion puis réessaie.";
  }
  return "Code PIN incorrect ou QR Code expiré. Génère un nouveau QR Code dans Pronote.";
}

export default function PronoteLoginWithQR() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const initialAccountType = route.params?.accountType;

  const { colors } = theme;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const handleRequestPermission = useCallback(() => {
    if (permission?.canAskAgain === false) {
      Linking.openSettings().catch(() => {});
      return;
    }
    requestPermission().catch(() => {});
  }, [permission?.canAskAgain, requestPermission]);

  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const [QRValidationCode, setQRValidationCode] = useState("");
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const alert = useAlert();

  const [loadingModalVisible, setLoadingModalVisible] = useState(false);

  const codeInput = React.createRef<TextInput>();
  const [QRData, setQRData] = useState<string | null>(null);
  // Garde anti double-tap : le jeton QR est à usage unique, deux appels
  // concurrents brûleraient le second avec une erreur 'dataSec' incompréhensible.
  const loginInFlight = React.useRef(false);

  // Relance l'init post-login depuis le dialogue d'échec (compte conservé).
  async function retryPostLoginInit(accountID: string) {
    setLoadingModalVisible(true);
    try {
      const { initAccountAfterLogin } = await import("./postLogin");
      await initAccountAfterLogin(accountID);
      setLoadingModalVisible(false);
      await hapticFor("success");
      const { finishAuthNavigation } =
        await import("@/utils/navigation/finishAuth");
      finishAuthNavigation();
    } catch (e) {
      logError(
        "QR post-login retry failed: " + String(e),
        "qrcode.retryPostLoginInit"
      );
      setLoadingModalVisible(false);
      await hapticFor("error");
      const { describeInitError } = await import("./postLogin");
      alert.showAlert({
        title: "Synchronisation impossible",
        description:
          "La synchronisation a encore échoué : " + describeInitError(e),
        icon: "Refresh",
        color: "#E05D34",
        customButton: {
          label: "Réessayer",
          showCancelButton: true,
          onPress: () => void retryPostLoginInit(accountID),
        },
      });
    }
  }

  async function loginQR() {
    if (loginInFlight.current) {
      return;
    }
    loginInFlight.current = true;
    setScanned(false);
    setLoadingModalVisible(true);

    if (QRValidationCode === "" || QRValidationCode.length !== 4) {
      setLoadingModalVisible(false);
      loginInFlight.current = false;
      await hapticFor("error");
      alert.showAlert({
        title: "Code incomplet",
        description: "Saisis les 4 chiffres affichés dans Pronote.",
        icon: "QrCode",
        color: "#E05D34",
      });
      return;
    }

    const accountID = uuid();
    const { getDeviceUuid } = await import("./postLogin");
    const deviceUuid = getDeviceUuid();

    try {
      const decodedJSON = JSON.parse(QRData!);
      const detectedAccountType =
        initialAccountType ||
        (decodedJSON?.url?.includes("parent") ? "parent" : "eleve");

      const res = await PronoteApiClient.qrCodeLogin(
        {
          jeton: decodedJSON.jeton,
          login: decodedJSON.login,
          url: decodedJSON.url,
        },
        QRValidationCode,
        deviceUuid,
        detectedAccountType
      );

      if (!res.success) {
        throw new Error("Échec de connexion QR Code");
      }

      const { firstName, lastName } = GetIdentityFromPronoteUsername(
        res.user?.name || decodedJSON.login
      );
      const schoolName = res.user?.establishment || "Pronote";
      const className = res.user?.class_name || "";
      const isParent =
        res.user?.account_type === "parent" ||
        (res.children && res.children.length > 0);
      const accountType = isParent ? "parent" : "eleve";
      const children = res.children || [];
      const selectedChild = children.length > 0 ? children[0].name : undefined;

      // Le backend renvoie aussi `credentials` = payload brut {url, username, token, uuid}.
      // On le stocke en clair (les 2 schémas de clés) : le refresh /auth/token a
      // besoin du token BRUT, pas du blob base64 (qui serait rejeté par Pronote).
      const rawCreds = (res.credentials ?? {}) as Record<string, any>;
      // Note : le `jeton` du QR est à usage unique, pas un token de session :
      // on ne le stocke jamais comme token (sinon /auth/token échoue à coup sûr).
      const rawToken = rawCreds.token || undefined;
      const rawUuid = rawCreds.uuid || deviceUuid;
      const rawUrl = rawCreds.url || decodedJSON.url;
      const rawUsername = rawCreds.username || decodedJSON.login;
      useAccountStore.getState().addAccount({
        id: accountID,
        firstName,
        lastName,
        schoolName,
        className,
        accountType,
        children,
        selectedChild,
        customisation: {
          profilePicture: "",
          subjects: {},
        },
        services: [
          {
            id: accountID,
            auth: {
              accessToken: res.auth_token,
              refreshToken: res.auth_token,
              additionals: {
                instanceURL: rawUrl,
                url: rawUrl,
                username: rawUsername,
                deviceUUID: deviceUuid,
                uuid: rawUuid,
                token: rawToken,
                authToken: res.auth_token,
                accountType,
                account_type: accountType,
              },
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
      // Vérifie que le compte s'initialise (manager + première session) AVANT
      // de quitter l'onboarding : sinon écran blanc + app vide en silence.
      // Le compte est conservé : en cas d'échec on propose Réessayer
      // (transitoire) plutôt que de forcer une reconnexion complète.
      try {
        const { initAccountAfterLogin } = await import("./postLogin");
        await initAccountAfterLogin(accountID);
      } catch (e) {
        logError("QR post-login init failed: " + String(e), "qrcode.loginQR");
        setLoadingModalVisible(false);
        loginInFlight.current = false;
        await hapticFor("error");
        const { describeInitError } = await import("./postLogin");
        alert.showAlert({
          title: "Synchronisation impossible",
          description:
            "Session créée, mais la première synchronisation a échoué : " +
            describeInitError(e),
          icon: "Refresh",
          color: "#E05D34",
          customButton: {
            label: "Réessayer",
            showCancelButton: true,
            onPress: () => void retryPostLoginInit(accountID),
          },
        });
        return;
      }
      setLoadingModalVisible(false);
      loginInFlight.current = false;
      const { finishAuthNavigation } =
        await import("@/utils/navigation/finishAuth");
      finishAuthNavigation();
    } catch (error: any) {
      logError(
        "QR Login Error: " + String(error?.message || error),
        "qrcode.loginQR"
      );
      setLoadingModalVisible(false);
      loginInFlight.current = false;
      await hapticFor("error");
      alert.showAlert({
        title: "Erreur de connexion",
        description: describeQRError(error),
        icon: "QrCode",
        color: "#E05D34",
      });
    }
  }

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain !== false) {
      requestPermission().catch(() => {});
    }
  }, [permission?.granted, requestPermission]);

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setQRData(data);
    setPinModalVisible(true);
  };

  useEffect(() => {
    if (!pinModalVisible) {
      setScanned(false);
      setQRData(null);
    }
  }, [pinModalVisible]);

  const keyboardDidShow = () => setKeyboardOpen(true);
  const keyboardDidHide = () => setKeyboardOpen(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      keyboardDidShow
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      keyboardDidHide
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={loadingModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }} />

          <ActivityIndicator size="large" />

          <Typography
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: colors.text,
              marginTop: 16,
            }}
          >
            {t("ONBOARDING_LOADING_LOGIN")}
          </Typography>

          <Typography
            style={{
              fontSize: 16,
              fontWeight: "400",
              color: colors.text + "80",
              marginTop: 4,
            }}
          >
            {t("ONBOARDING_QRCODE_WAIT")}
          </Typography>

          <View style={{ flex: 1 }} />

          <View
            style={{
              width: "100%",
              paddingHorizontal: 16,
              paddingBottom: insets.bottom,
              gap: 8,
            }}
          >
            <Button
              title={t("CANCEL_BTN")}
              onPress={() => {
                setLoadingModalVisible(false);
                router.back();
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={pinModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setPinModalVisible(!pinModalVisible);
        }}
      >
        <KeyboardAvoidingView
          style={{
            flex: 1,
            backgroundColor: colors.background,
          }}
          behavior="padding"
          keyboardVerticalOffset={insets.top}
        >
          <View
            style={{
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 24,
              paddingVertical: 16,
              paddingHorizontal: 20,
              borderBottomColor: colors.border,
              borderBottomWidth: 0.5,
            }}
          >
            <Typography
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: colors.text,
                textAlign: "center",
              }}
            >
              {t("ONBOARDING_QRCODE_VALIDATION")}
            </Typography>
          </View>

          <Reanimated.View
            entering={FadeInUp.duration(250)}
            exiting={FadeOutUp.duration(150)}
            style={{
              zIndex: 9999,
              paddingTop: keyboardOpen ? 20 : 100,
              alignItems: "center",
            }}
            layout={LinearTransition}
          >
            <Typography
              style={{
                color: colors.text,
                fontSize: 16,
                textAlign: "center",
                marginHorizontal: 24,
                fontWeight: "400",
                width: 300,
                marginBottom: 12,
              }}
            >
              {t("ONBOARDING_PRONOTE_PIN")}
            </Typography>
          </Reanimated.View>

          <View
            style={{
              flex: 1,
              alignItems: "center",
              marginBottom: "7%",
            }}
          >
            <TextInput
              style={{
                width: "90%",
                paddingHorizontal: 20,
                paddingVertical: 15,
                backgroundColor: colors.card,
                borderRadius: 12,
                fontSize: 24,
                color: colors.text,
                textAlign: "center",
                borderColor: colors.border,
                borderWidth: 2,
                fontWeight: "500",
              }}
              placeholderTextColor={colors.text + "80"}
              placeholder="••••"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              value={QRValidationCode}
              onChangeText={text => setQRValidationCode(text)}
              ref={codeInput}
              autoFocus
            />
          </View>

          <View
            style={{
              width: "100%",
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 16,
              gap: 8,
            }}
          >
            <Button
              title={t("CONFIRM_BTN")}
              onPress={() => {
                setPinModalVisible(false);
                loginQR();
              }}
            />
            <Button
              title={t("CANCEL_BTN")}
              variant="outline"
              onPress={() => {
                setPinModalVisible(false);
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={[styles.explainations, { top: insets.top + 48 + 10 }]}>
        <Icon size={40} fill={"white"} papicon>
          <Papicons name="QrCode" />
        </Icon>
        <Typography style={styles.title}>
          {t("ONBOARDING_LOGIN_TO")} PRONOTE
        </Typography>
        <Typography style={styles.text}>
          {t("ONBOARDING_SCAN_QRCODE")}
        </Typography>
      </View>

      <View style={StyleSheet.absoluteFill}>
        {permission?.granted && !cameraError ? (
          <CameraView
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            onMountError={() => setCameraError("Impossible d'ouvrir la caméra")}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { alignItems: "center", justifyContent: "center", padding: 32 },
            ]}
          >
            {!permission ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : cameraError ? (
              <>
                <Typography
                  style={[
                    styles.text,
                    { textAlign: "center", marginBottom: 16 },
                  ]}
                >
                  {cameraError}
                </Typography>
                <Pressable
                  onPress={() => {
                    setCameraError(null);
                    setScanned(false);
                  }}
                  style={{
                    backgroundColor: "#FFFFFF2A",
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 16,
                  }}
                >
                  <Typography style={styles.title}>Réessayer</Typography>
                </Pressable>
              </>
            ) : (
              <>
                <Typography
                  style={[
                    styles.text,
                    { textAlign: "center", marginBottom: 16 },
                  ]}
                >
                  {t("ONBOARDING_CAMERA_PERMISSION") ||
                    "Aether a besoin de la caméra pour scanner le QR Code."}
                </Typography>
                <Pressable
                  onPress={handleRequestPermission}
                  style={{
                    backgroundColor: "#FFFFFF",
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 16,
                  }}
                >
                  <Typography
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#000",
                      textAlign: "center",
                    }}
                  >
                    {permission?.canAskAgain === false
                      ? "Ouvrir les réglages"
                      : "Autoriser la caméra"}
                  </Typography>
                </Pressable>
              </>
            )}
          </View>
        )}
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={
            <View style={styles.maskContainer}>
              <View style={styles.transparentSquare} />
            </View>
          }
          pointerEvents="none"
        >
          <View style={styles.maskContainer} />
          <View style={styles.transparentSquareBorder} />
        </MaskedView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  maskContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  transparentSquare: {
    position: "absolute",
    width: 300,
    height: 300,
    backgroundColor: "black",
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 30,
    borderCurve: "continuous",
    alignSelf: "center",
    top: "35%",
  },
  backButton: {
    position: "absolute",
    left: 16,
    zIndex: 200,
    backgroundColor: "#ffffff42",
    padding: 10,
    borderRadius: 100,
  },
  transparentSquareBorder: {
    position: "absolute",
    width: 300,
    height: 300,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 30,
    borderCurve: "continuous",
    alignSelf: "center",
    top: "35%",
  },

  explainations: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
    gap: 4,
    zIndex: 9999,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    textAlign: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "400",
    color: "white",
    textAlign: "center",
    opacity: 0.8,
  },
});
