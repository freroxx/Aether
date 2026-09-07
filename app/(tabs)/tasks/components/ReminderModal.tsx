import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import React, { useMemo } from "react";
import { Modal, Pressable, View } from "react-native";

import Icon from "@/ui/components/Icon";
import Typography from "@/ui/new/Typography";

export interface ReminderPreset {
  label: string;
  at: number;
  repeat?: "none" | "hourly" | "bihourly";
  hint?: string;
}

export const DONE_TASK_MESSAGES: string[] = [
  "Tu as déjà complété cette tâche !",
  "Celle-là est déjà bouclée, bravo !",
  "Mission accomplie, pas besoin de rappel !",
  "Déjà terminée, tu peux te détendre !",
  "Tu l'as déjà finie, champion !",
];

interface ReminderModalProps {
  visible: boolean;
  taskTitle: string;
  subjectName: string;
  isDone: boolean;
  presets: ReminderPreset[];
  onPick: (preset: ReminderPreset) => void;
  onClose: () => void;
}

function formatAt(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const ReminderModal: React.FC<ReminderModalProps> = ({
  visible,
  taskTitle,
  subjectName,
  isDone,
  presets,
  onPick,
  onClose,
}) => {
  const theme = useTheme();
  const doneMessage = useMemo(
    () => DONE_TASK_MESSAGES[Math.floor(Math.random() * DONE_TASK_MESSAGES.length)],
    [visible]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
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
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: `${String(theme.colors.primary)}1A`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon>
                <Papicons name={isDone ? "Check" : "Bell"} />
              </Icon>
            </View>
          </View>

          <Typography variant="title" align="center" numberOfLines={2}>
            {isDone ? doneMessage : "Ajouter un rappel"}
          </Typography>
          <Typography color="textSecondary" align="center" numberOfLines={2} style={{ marginBottom: 8 }}>
            {isDone ? subjectName : `${subjectName} — ${taskTitle}`}
          </Typography>

          {isDone ? (
            <Pressable
              onPress={onClose}
              style={{
                backgroundColor: theme.colors.primary,
                borderRadius: 16,
                paddingVertical: 12,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <Typography variant="body1" weight="bold" style={{ color: "#FFFFFF" }}>
                OK
              </Typography>
            </Pressable>
          ) : (
            <>
              {presets.map(p => (
                <Pressable
                  key={p.label}
                  onPress={() => onPick(p)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    backgroundColor: pressed
                      ? `${String(theme.colors.primary)}22`
                      : `${String(theme.colors.primary)}0D`,
                    marginTop: 8,
                  })}
                >
                  <Icon>
                    <Papicons name={"Clock"} />
                  </Icon>
                  <View style={{ flex: 1 }}>
                    <Typography variant="body1" weight="bold">
                      {p.label}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {p.hint ? `${formatAt(p.at)} · ${p.hint}` : formatAt(p.at)}
                    </Typography>
                  </View>
                </Pressable>
              ))}
              <Pressable
                onPress={onClose}
                style={{
                  borderRadius: 16,
                  paddingVertical: 12,
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <Typography variant="body1" color="textSecondary">
                  Annuler
                </Typography>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default ReminderModal;
