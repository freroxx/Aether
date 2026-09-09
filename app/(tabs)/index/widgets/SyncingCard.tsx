import { useTheme } from "expo-router/react-navigation";
import { t } from "i18next";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";

/** Carte affichée sur l'Accueil pendant la synchro (sobre, statique, localisée). */
const SyncingCard = React.memo(() => {
  const theme = useTheme();

  return (
    <View style={{ width: "100%", paddingHorizontal: 10, paddingBottom: 12 }}>
      <Stack gap={10} padding={[16, 14]} radius={18} card>
        <Stack direction="horizontal" vAlign="center" hAlign="center" gap={12}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: `${String(theme.colors.primary)}14`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator size="small" color={String(theme.colors.primary)} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Typography variant="title" weight="bold" numberOfLines={1}>
              {t("Home_Syncing_Title", "Synchronisation…")}
            </Typography>
            <Typography variant="body2" color="secondary" numberOfLines={2}>
              {t("Home_Syncing_Desc", "Tes cours, devoirs et notes arrivent.")}
            </Typography>
          </View>
        </Stack>
      </Stack>
    </View>
  );
});

SyncingCard.displayName = "SyncingCard";

export default SyncingCard;
