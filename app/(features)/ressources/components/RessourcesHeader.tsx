import { t } from "i18next";
import React from "react";
import { Pressable } from "react-native";
import { useTheme } from "expo-router/react-navigation";

import Search from "@/ui/components/Search";
import Stack from "@/ui/components/Stack";
import TabHeader from "@/ui/components/TabHeader";
import TabHeaderTitle from "@/ui/components/TabHeaderTitle";
import Typography from "@/ui/components/Typography";

import type { ViewMode } from "../hooks/useRessourcesData";
import { RESSOURCES_ACCENT } from "./SessionCard";

interface RessourcesHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  titleNumber: string;
  subtitle?: string;
  onSearchChange: (text: string) => void;
}

const RessourcesHeader: React.FC<RessourcesHeaderProps> = ({
  viewMode,
  onViewModeChange,
  titleNumber,
  subtitle,
  onSearchChange,
}) => {
  const { colors } = useTheme();
  return (
    <TabHeader
      title={
        <TabHeaderTitle
          leading={t("Ressources_Title", "Contenus")}
          subtitle={subtitle}
          number={titleNumber}
          color={RESSOURCES_ACCENT}
          height={56}
        />
      }
      trailing={
        <Stack direction="horizontal" gap={8}>
          <Pressable
            onPress={() => onViewModeChange("chrono")}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 300,
              backgroundColor:
                viewMode === "chrono" ? RESSOURCES_ACCENT : colors.card,
            }}
            accessibilityLabel={t(
              "Ressources_View_Chrono",
              "Vue chronologique"
            )}
          >
            <Typography
              color={viewMode === "chrono" ? "#FFFFFF" : undefined}
            >
              {t("Ressources_View_Chrono_Short", "Chrono")}
            </Typography>
          </Pressable>
          <Pressable
            onPress={() => onViewModeChange("weekly")}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 300,
              backgroundColor:
                viewMode === "weekly" ? RESSOURCES_ACCENT : colors.card,
            }}
            accessibilityLabel={t(
              "Ressources_View_Weekly",
              "Vue hebdomadaire"
            )}
          >
            <Typography
              color={viewMode === "weekly" ? "#FFFFFF" : undefined}
            >
              {t("Ressources_View_Weekly_Short", "Semaine")}
            </Typography>
          </Pressable>
        </Stack>
      }
      bottom={
        <Search
          placeholder={t(
            "Ressources_Search_Placeholder",
            "Rechercher un cours, un chapitre…"
          )}
          color={RESSOURCES_ACCENT}
          onTextChange={onSearchChange}
          style={{ marginTop: 6 }}
        />
      }
    />
  );
};

export default RessourcesHeader;
