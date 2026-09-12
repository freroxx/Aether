import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, TextInput, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { getManager } from "@/services/shared";
import { useAlert } from "@/ui/components/AlertProvider";
import Icon from "@/ui/components/Icon";
import Button from "@/ui/new/Button";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";

export default function SettingsQrShare() {
  const { t } = useTranslation();
  const theme = useTheme();
  const alert = useAlert();

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrString, setQrString] = useState<string | null>(null);

  const canGenerate = pin.length === 4 && !loading;

  const handleGenerate = async () => {
    if (pin.length !== 4) {
      alert.showAlert({
        title: t("QrShare_Pin_Incomplete_Title", "Code incomplet"),
        message: t("QrShare_Pin_Incomplete_Description", "Saisis les 4 chiffres du code PIN."),
        description: t("QrShare_Pin_Incomplete_Description", "Saisis les 4 chiffres du code PIN."),
        icon: "QrCode",
      });
      return;
    }
    setLoading(true);
    try {
      const manager = getManager();
      if (!manager) {
        alert.showAlert({
          title: t("QrShare_Unavailable_Title", "Service indisponible"),
          message: t("QrShare_Unavailable_Description", "Reconnecte-toi pour générer un QR Code."),
          description: t("QrShare_Unavailable_Description", "Reconnecte-toi pour générer un QR Code."),
          icon: "QrCode",
        });
        return;
      }
      const res = await manager.requestQrCode(pin);
      const raw = (res as { qr?: unknown })?.qr ?? res;
      const str = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (!str) {
        alert.showAlert({
          title: t("QrShare_Empty_Title", "Aucun QR Code"),
          message: t("QrShare_Empty_Description", "Pronote n'a renvoyé aucun QR Code."),
          description: t("QrShare_Empty_Description", "Pronote n'a renvoyé aucun QR Code."),
          icon: "QrCode",
        });
        return;
      }
      setQrString(str);
    } catch (e) {
      alert.showAlert({
        title: t("QrShare_Error_Title", "Génération impossible"),
        message: String((e as Error)?.message ?? e).slice(0, 180) || t("QrShare_Error_Description", "Le QR Code n'a pas pu être généré."),
        description: String((e as Error)?.message ?? e).slice(0, 180) || t("QrShare_Error_Description", "Le QR Code n'a pas pu être généré."),
        icon: "QrCode",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!qrString) return;
    try {
      await Clipboard.setStringAsync(qrString);
      alert.showAlert({
        title: t("QrShare_Copied_Title", "Copié"),
        message: t("QrShare_Copied_Description", "Contenu du QR Code copié."),
        description: t("QrShare_Copied_Description", "Contenu du QR Code copié."),
        icon: "Check",
      });
    } catch {
      // best-effort
    }
  };

  return (
    <List
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      contentInsetAdjustmentBehavior="always"
    >
      <List.Section>
        <List.SectionTitle>
          <List.Label>{t("QrShare_Pin_Section", "Code PIN")}</List.Label>
        </List.SectionTitle>
        <List.View>
          <View style={{ gap: 10 }}>
            <TextInput
              value={pin}
              onChangeText={text => {
                setPin(text.replace(/[^0-9]/g, "").slice(0, 4));
              }}
              placeholder="••••"
              placeholderTextColor={String(theme.colors.text) + "60"}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 16,
                padding: 14,
                color: theme.colors.text,
                fontSize: 24,
                textAlign: "center",
                letterSpacing: 8,
                backgroundColor: theme.colors.card,
                fontWeight: "600",
              }}
            />
            <Typography variant="body2" color="textSecondary">
              {t("QrShare_Pin_Hint", "Saisis le code à 4 chiffres pour générer un QR Code de connexion.")}
            </Typography>
          </View>
        </List.View>
        <List.Item>
          <List.Leading>
            <Icon>
              <Papicons name="QrCode" />
            </Icon>
          </List.Leading>
          <Typography variant="title">{t("QrShare_Generate_Title", "Générer")}</Typography>
          <Typography variant="body1" color="textSecondary">
            {t("QrShare_Generate_Description", "Crée un QR Code à flasher dans Pronote.")}
          </Typography>
          <List.Trailing>
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Button
                label={t("QrShare_Generate_Title", "Générer")}
                variant="primary"
                disabled={!canGenerate}
                onPress={() => void handleGenerate()}
              />
            )}
          </List.Trailing>
        </List.Item>
      </List.Section>

      {qrString && (
        <List.Section>
          <List.SectionTitle>
            <List.Label>{t("QrShare_Result_Section", "QR Code")}</List.Label>
          </List.SectionTitle>
          <List.View>
            <View style={{ alignItems: "center", gap: 14, paddingVertical: 8 }}>
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  padding: 16,
                }}
              >
                <QRCode value={qrString} size={200} backgroundColor="#FFFFFF" color="#000000" />
              </View>
              <Typography variant="body2" color="textSecondary" numberOfLines={3} style={{ textAlign: "center" }}>
                {qrString.slice(0, 160)}
                {qrString.length > 160 ? "…" : ""}
              </Typography>
              <Button
                label={t("QrShare_Copy_Title", "Copier")}
                variant="outlined"
                onPress={() => void handleCopy()}
              />
            </View>
          </List.View>
        </List.Section>
      )}
    </List>
  );
}
