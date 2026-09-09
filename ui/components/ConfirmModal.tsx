import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import React from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";

import Icon from "@/ui/components/Icon";
import Typography from "@/ui/new/Typography";

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Pop-up custom assortie au design Aether (remplace Alert.alert natif).
 * Carte arrondie 24, backdrop dim, icône 48px, boutons pill du design system.
 */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  description,
  icon = "AlertTriangle",
  iconColor,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}) => {
  const theme = useTheme();
  const accent = iconColor ?? (destructive ? "#E05D34" : String(theme.colors.primary));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 380,
            backgroundColor: theme.colors.card,
            borderRadius: 24,
            padding: 20,
            gap: 4,
            borderWidth: 1,
            borderColor: `${String(theme.colors.text)}14`,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: `${accent}1A`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon papicon size={26} fill={accent}>
                <Papicons name={icon as any} />
              </Icon>
            </View>
          </View>

          <Typography variant="title" align="center" numberOfLines={3}>
            {title}
          </Typography>
          {!!description && (
            <Typography color="textSecondary" align="center" style={{ marginTop: 6, marginBottom: 8 }}>
              {description}
            </Typography>
          )}

          <View style={{ gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={({ pressed }) => ({
                backgroundColor: destructive ? "#E05D34" : String(theme.colors.primary),
                borderRadius: 500,
                height: 48,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                opacity: loading ? 0.7 : pressed ? 0.85 : 1,
              })}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : null}
              <Typography variant="title" style={{ color: "#FFFFFF" }}>
                {confirmLabel}
              </Typography>
            </Pressable>
            <Pressable
              onPress={onClose}
              disabled={loading}
              style={{
                borderRadius: 500,
                paddingVertical: 12,
                alignItems: "center",
                opacity: loading ? 0.5 : 1,
              }}
            >
              <Typography variant="body1" color="textSecondary">
                {cancelLabel}
              </Typography>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default ConfirmModal;
