import { Papicons } from "@getpapillon/papicons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import Icon from "@/ui/components/Icon";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";

export const SYNCING_MESSAGES = [
  "Synchronisation avec Pronote en cours…",
  "On récupère tes cours, un instant…",
  "On range tes devoirs dans ton cartable…",
  "Connexion à la vie scolaire en cours…",
  "On polit tes notes, promis on ne triche pas…",
  "Chargement de tes évaluations…",
  "On dépoussière ton emploi du temps…",
  "Tes données arrivent, reste avec nous…",
];

/** Carte affichée sur l'Accueil pendant la première synchro (évite l'écran vide). */
const SyncingCard = React.memo(() => {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * SYNCING_MESSAGES.length)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SYNCING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
      <Stack gap={8} padding={[14, 14]} radius={18} card>
        <Stack direction="horizontal" vAlign="center" hAlign="center" gap={10}>
          <ActivityIndicator size="small" />
          <Icon papicon opacity={0.7}>
            <Papicons name="Refresh" />
          </Icon>
          <Typography variant="title" weight="bold" style={{ flex: 1 }} numberOfLines={2}>
            {SYNCING_MESSAGES[index]}
          </Typography>
        </Stack>
        <Typography variant="body2" color="secondary" numberOfLines={2}>
          Première connexion : on importe tes cours, devoirs et notes depuis Pronote. Ça peut prendre une minute.
        </Typography>
      </Stack>
    </View>
  );
});

SyncingCard.displayName = "SyncingCard";

export default SyncingCard;
