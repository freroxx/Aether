import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MaterialIcon, { MaterialIconName } from "@/ui/components/MaterialIcon";
import Stack from "@/ui/components/Stack";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";

const ROADMAP: Array<{ icon: MaterialIconName; title: string; description: string }> = [
  {
    icon: "auto-awesome",
    title: "Réponses assistées",
    description:
      "De l'aide pour démarrer un devoir : pistes de résolution, jamais de réponses toutes faites.",
  },
  {
    icon: "sort",
    title: "Organisation intelligente",
    description:
      "Tes devoirs triés par difficulté et urgence pour savoir par où commencer.",
  },
  {
    icon: "insights",
    title: "Et bien plus",
    description:
      "D'autres idées arrivent — tout est calculé sur ton téléphone, rien n'est envoyé.",
  },
];

export default function ZenScreen() {
  const insets = useSafeAreaInsets();

  return (
    <List
      contentContainerStyle={{
        padding: 16,
        paddingBottom: insets.bottom + 16,
      }}
    >
      <List.View>
        <Stack gap={10} vAlign="center" hAlign="center" padding={[24, 8]}>
          <MaterialIcon name="auto-awesome" size={44} />
          <Typography variant="h2" align="center">
            OpenCode Zen
          </Typography>
          <Typography variant="body1" color="secondary" align="center">
            Le futur assistant d&apos;Aether, en préparation. Patience —
            ça arrive (vraiment) bientôt !
          </Typography>
        </Stack>
      </List.View>
      <List.Section id="zen-roadmap">
        {ROADMAP.map(item => (
          <List.Item key={item.title}>
            <List.Leading>
              <MaterialIcon name={item.icon} size={24} />
            </List.Leading>
            <Typography variant="title">{item.title}</Typography>
            <Typography variant="body1" color="textSecondary">
              {item.description}
            </Typography>
          </List.Item>
        ))}
      </List.Section>
    </List>
  );
}
