import { useSettingsStore } from "@/stores/settings";
import {
  NativeHeaderPressable,
  NativeHeaderSide,
} from "@/ui/components/NativeHeader";
import Icon from "@/ui/components/Icon";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import { useTheme } from "expo-router/react-navigation";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { router } from "expo-router";
import { Papicons } from "@getpapillon/papicons";
import { ImagePlus } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";

interface PresetGradient {
  id: string;
  name: string;
  colors: string[];
}

const GRADIENT_PRESETS: PresetGradient[] = [
  {
    id: "grad_aurora",
    name: "Aether Aurora",
    colors: ["#134E5E", "#29947A", "#71B280"],
  },
  {
    id: "grad_crepuscule",
    name: "Crépuscule",
    colors: ["#3A1C71", "#D76D77", "#FFAF7B"],
  },
  {
    id: "grad_ocean",
    name: "Océan Profond",
    colors: ["#0F2027", "#203A43", "#2C5364"],
  },
  {
    id: "grad_nebuleuse",
    name: "Nébuleuse",
    colors: ["#4A00E0", "#8E2DE2"],
  },
  {
    id: "grad_menthe",
    name: "Menthe Glacée",
    colors: ["#0575E6", "#00F260"],
  },
  {
    id: "grad_peche",
    name: "Pêche Solaire",
    colors: ["#F857A6", "#FF5858"],
  },
  {
    id: "grad_foret",
    name: "Forêt d'Émeraude",
    colors: ["#0B2B20", "#1E6B55", "#4CAF50"],
  },
  {
    id: "grad_obsidienne",
    name: "Obsidienne Nuit",
    colors: ["#111827", "#1F2937", "#374151"],
  },
  {
    id: "grad_pastel",
    name: "Pastel Doux",
    colors: ["#654ea3", "#eaafc8"],
  },
  {
    id: "grad_braise",
    name: "Braise Chaude",
    colors: ["#8A2387", "#E94057", "#F27121"],
  },
];

interface RadiancePreset {
  id: string;
  name: string;
  type: "image" | "gradient";
  colors?: string[];
}

const RADIANCE_PRESETS: RadiancePreset[] = [
  {
    id: "radiance_default_clouds",
    name: "Nuages Aether (Défaut)",
    type: "image",
  },
  {
    id: "radiance_deep_aether",
    name: "Éther Minimaliste",
    type: "gradient",
    colors: ["#1B2B27", "#0F1815"],
  },
  {
    id: "radiance_boreal_dawn",
    name: "Aube Boréale",
    type: "gradient",
    colors: ["#122B24", "#1E5848", "#2C856E"],
  },
  {
    id: "radiance_astral_midnight",
    name: "Minuit Astral",
    type: "gradient",
    colors: ["#0A0E17", "#131C2D", "#1A263D"],
  },
];

const playSelection = () => {
  try {
    Haptics.selectionAsync();
  } catch {}
};

const WallpaperModal = () => {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const settingsStore = useSettingsStore(state => state.personalization);
  const mutateProperty = useSettingsStore(state => state.mutateProperty);
  const currentWallpaper = settingsStore.wallpaper;
  const selectedId = currentWallpaper?.id;

  const wallpaperDirectory = new Directory(Paths.document, "wallpapers");

  const selectGradient = (gradient: PresetGradient) => {
    mutateProperty("personalization", {
      wallpaper: {
        id: gradient.id,
        type: "gradient",
        gradient: {
          colors: gradient.colors,
          name: gradient.name,
        },
      },
    });
  };

  const selectRadiance = (preset: RadiancePreset) => {
    if (preset.type === "image") {
      // Default bundled image
      mutateProperty("personalization", {
        wallpaper: undefined,
      });
    } else if (preset.colors) {
      mutateProperty("personalization", {
        wallpaper: {
          id: preset.id,
          type: "gradient",
          gradient: {
            colors: preset.colors,
            name: preset.name,
          },
        },
      });
    }
  };

  const uploadCustomWallpaper = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const sourceFile = new File(asset.uri);

      if (!wallpaperDirectory.exists) {
        wallpaperDirectory.create();
      }

      const newFileName = `custom_${Date.now()}.jpg`;
      const destFile = new File(wallpaperDirectory, newFileName);

      sourceFile.copy(destFile);

      mutateProperty("personalization", {
        wallpaper: {
          id: `custom:${Date.now()}`,
          type: "image",
          path: {
            directory: wallpaperDirectory.name,
            name: destFile.name,
          },
        },
      });
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger l'image sélectionnée.");
    }
  };

  const resetToDefault = () => {
    mutateProperty("personalization", {
      wallpaper: undefined,
    });
  };

  const isDefaultSelected = !currentWallpaper;
  const isCustomActive = currentWallpaper?.id?.startsWith("custom:") ?? false;

  const [customImageUri, setCustomImageUri] = useState<string | null>(null);

  useEffect(() => {
    if (currentWallpaper?.type === "image" && currentWallpaper?.path?.name) {
      const file = new File(
        Paths.document,
        currentWallpaper.path.directory || "",
        currentWallpaper.path.name
      );
      if (file.exists) {
        setCustomImageUri(file.uri);
      } else {
        setCustomImageUri(null);
      }
    } else {
      setCustomImageUri(null);
    }
  }, [currentWallpaper]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Android Drag Handle & Sheet Header */}
      {Platform.OS === "android" && (
        <View style={styles.sheetHeaderWrapper}>
          <View
            style={[
              styles.dragHandle,
              {
                backgroundColor: dark
                  ? "rgba(255,255,255,0.25)"
                  : "rgba(0,0,0,0.18)",
              },
            ]}
          />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Typography variant="title" weight="bold">
                Fond d&apos;écran d&apos;accueil
              </Typography>
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {currentWallpaper && (
                <Pressable
                  onPress={resetToDefault}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.headerIconButton,
                    {
                      backgroundColor: dark
                        ? "rgba(224,93,52,0.15)"
                        : "rgba(224,93,52,0.1)",
                      opacity: pressed ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <Icon size={18}>
                    <Papicons name="Trash" color="#E05D34" />
                  </Icon>
                </Pressable>
              )}

              <Pressable
                onPress={() => router.back()}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  {
                    backgroundColor: dark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)",
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  },
                ]}
              >
                <Icon size={20}>
                  <Papicons name="Cross" />
                </Icon>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <List
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
        }}
        contentInsetAdjustmentBehavior="always"
      >
        <List.Section>
          <List.SectionTitle>
            <List.Label>Photo</List.Label>
          </List.SectionTitle>
          <List.Item onPress={uploadCustomWallpaper}>
            <List.Leading>
              {customImageUri ? (
                <Image
                  source={{ uri: customImageUri }}
                  style={styles.galleryThumb}
                />
              ) : (
                <Icon>
                  <ImagePlus size={22} color={colors.text} />
                </Icon>
              )}
            </List.Leading>
            <Typography variant="title">Depuis la galerie</Typography>
            <Typography color="textSecondary">
              {isCustomActive ? "Image personnalisée" : "JPG ou PNG"}
            </Typography>
            <List.Trailing>
              {isCustomActive ? (
                <Icon size={22} papicon>
                  <Papicons name="Check" color={String(colors.primary)} />
                </Icon>
              ) : (
                <Icon>
                  <Papicons name="ChevronRight" opacity={0.7} />
                </Icon>
              )}
            </List.Trailing>
          </List.Item>
        </List.Section>

        <List.Section>
          <List.SectionTitle>
            <List.Label>Dégradés</List.Label>
          </List.SectionTitle>
          <List.View>
            <View style={styles.gradientGrid}>
              {GRADIENT_PRESETS.map(gradient => {
                const isSelected = selectedId === gradient.id;
                return (
                  <Pressable
                    key={gradient.id}
                    onPress={() => {
                      playSelection();
                      selectGradient(gradient);
                    }}
                    style={({ pressed }) => [
                      styles.gradientCardWrapper,
                      {
                        borderColor: isSelected
                          ? colors.primary
                          : "transparent",
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    <View style={styles.previewWrap}>
                      <LinearGradient
                        colors={gradient.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientPreview}
                      />
                      {isSelected && (
                        <View style={styles.checkOverlay} pointerEvents="none">
                          <View style={styles.checkPill}>
                            <Icon size={14}>
                              <Papicons name="Check" color="#FFFFFF" />
                            </Icon>
                          </View>
                        </View>
                      )}
                    </View>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      align="center"
                      numberOfLines={1}
                      style={{ marginTop: 4, fontSize: 11 }}
                    >
                      {gradient.name}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </List.View>
        </List.Section>

        <List.Section>
          <List.SectionTitle>
            <List.Label>Ambiances</List.Label>
          </List.SectionTitle>
          <List.View>
            <View style={styles.gradientGrid}>
              {RADIANCE_PRESETS.map(preset => {
                const isSelected =
                  (preset.id === "radiance_default_clouds" &&
                    isDefaultSelected) ||
                  selectedId === preset.id;

                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => {
                      playSelection();
                      selectRadiance(preset);
                    }}
                    style={({ pressed }) => [
                      styles.gradientCardWrapper,
                      {
                        borderColor: isSelected
                          ? colors.primary
                          : "transparent",
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    <View style={styles.previewWrap}>
                      {preset.type === "image" ? (
                        <Image
                          source={require("@/assets/images/wallpapers/clouds.jpg")}
                          style={styles.gradientPreview}
                        />
                      ) : (
                        <LinearGradient
                          colors={preset.colors!}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.gradientPreview}
                        />
                      )}

                      {isSelected && (
                        <View style={styles.checkOverlay} pointerEvents="none">
                          <View style={styles.checkPill}>
                            <Icon size={14}>
                              <Papicons name="Check" color="#FFFFFF" />
                            </Icon>
                          </View>
                        </View>
                      )}
                    </View>

                    <Typography
                      variant="caption"
                      color="textSecondary"
                      align="center"
                      numberOfLines={1}
                      style={{ marginTop: 4, fontSize: 11 }}
                    >
                      {preset.name}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </List.View>
        </List.Section>
      </List>

      {/* iOS Header controls */}
      {Platform.OS === "ios" && (
        <>
          <NativeHeaderSide side="Left">
            <NativeHeaderPressable onPress={() => router.back()}>
              <Icon size={26}>
                <Papicons name="Cross" />
              </Icon>
            </NativeHeaderPressable>
          </NativeHeaderSide>

          <NativeHeaderSide side="Right">
            {currentWallpaper && (
              <NativeHeaderPressable onPress={resetToDefault}>
                <Icon>
                  <Papicons name="Trash" color="#E05D34" />
                </Icon>
              </NativeHeaderPressable>
            )}
          </NativeHeaderSide>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: undefined,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  sheetHeaderWrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  gradientGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  gradientCardWrapper: {
    width: "48%",
    borderRadius: 18,
    padding: 2,
    borderWidth: 2.5,
  },
  gradientPreview: {
    width: "100%",
    height: 84,
    borderRadius: 16,
    overflow: "hidden",
  },
  previewWrap: {
    width: "100%",
    height: 84,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  checkPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default WallpaperModal;
