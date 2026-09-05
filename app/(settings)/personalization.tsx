import { Alert, Modal, Platform, ScrollView, Switch, TextInput, View } from "react-native";
import Stack from "@/ui/components/Stack";
import { EarthIcon } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import Typography from "@/ui/new/Typography";
import Button from "@/ui/new/Button";
import Icon from "@/ui/components/Icon";
import { Papicons, PapillonApp } from "@getpapillon/papicons";
import AnimatedPressable from "@/ui/components/AnimatedPressable";
import { useTheme, useHeaderHeight } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppColorsSelector from "@/components/AppColorsSelector";
import { AppColors } from "@/utils/colors";
import LinearGradient from "react-native-linear-gradient";
import adjust from "@/utils/adjustColor";
import { useAccountStore } from "@/stores/account";
import { DEFAULT_MATERIAL_YOU_ENABLED, useSettingsStore } from "@/stores/settings";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { Dynamic } from "@/ui/components/Dynamic";
import { FadeIn, FadeOut } from "react-native-reanimated";
import List from "@/ui/new/List";
import NativeSwitch from "@/ui/native/NativeSwitch";
import Picker from "@/ui/components/Picker";

const FONT_OPTIONS = [
  { label: "SN Pro", value: "sn-pro" as const },
  { label: "Fixel Text", value: "fixel-text" as const },
  { label: "Oxanium", value: "oxanium" as const },
  { label: "Courgette", value: "courgette" as const },
  { label: "IBM Plex Serif", value: "ibm-plex-serif" as const },
];

const PersonalizationSettings = () => {
  const theme = useTheme();
  const { t } = useTranslation()

  const store = useAccountStore.getState();
  const settingsStore = useSettingsStore(state => state.personalization);
  const mutateProperty = useSettingsStore(state => state.mutateProperty);
  const useMaterialYou = settingsStore.useMaterialYou ?? DEFAULT_MATERIAL_YOU_ENABLED;
  const selectedFontFamily = settingsStore.fontFamily ?? "sn-pro";
  const selectedFontIndex = Math.max(
    FONT_OPTIONS.findIndex(option => option.value === selectedFontFamily),
    0
  );

  const defaultColorData = AppColors.find(color => color.colorEnum === settingsStore.colorSelected) || AppColors[0];
  const [selectedColor, setSelectedColor] = React.useState<string>(defaultColorData.mainColor);
  const [selectedTheme, setSelectedTheme] = React.useState<"light" | "dark" | "auto">("auto");
  const [showApiUrlModal, setShowApiUrlModal] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState(settingsStore.pronoteApiUrl || "");

  const height = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const headerOffset = Math.max(height || 0, insets.top + 56);

  useEffect(() => {
    if (settingsStore.theme) {
      setSelectedTheme(settingsStore.theme);
    }
  }, []);

  useEffect(() => {
    mutateProperty('personalization', { theme: selectedTheme });
  }, [selectedTheme]);

  return (
    <>
      <Dynamic animated entering={FadeIn} exiting={FadeOut} key={'color-grad-stgs:' + theme.colors.primary}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primary + "00"]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 400,
            opacity: useMaterialYou ? 0.4 : 1,
          }}
        />
      </Dynamic>
      <List
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: Platform.OS === "android" ? headerOffset + 8 : 16,
          paddingBottom: insets.bottom + 32,
        }}
        contentInsetAdjustmentBehavior="always"
        style={{ flex: 1 }}
      >
        {!useMaterialYou &&
          <List.Section>
            <List.SectionTitle>
              <List.Label>Choix de la couleur</List.Label>
            </List.SectionTitle>
            <List.View>
              <AppColorsSelector
                onChangeColor={(color: string) => {
                  setSelectedColor(color);
                  setTimeout(() => {
                    const colorData = AppColors.find(appColor => appColor.mainColor === color);
                    if (colorData) {
                      mutateProperty('personalization', {
                        colorSelected: colorData.colorEnum
                      });
                    }
                  }, 50);
                }}
                accountId={store.lastUsedAccount}
              />
            </List.View>
          </List.Section>
        }

        <List.Section>
          <List.SectionTitle>
            <List.Label>Options du thème</List.Label>
          </List.SectionTitle>
          {Platform.OS === "android" && Platform.Version >= 31 && (
            <List.Item>
              <List.Leading>
                <Icon>
                  <Papicons name={"Palette"} />
                </Icon>
              </List.Leading>
              <Typography variant="caption" color={"primary"}>{t("Global_Recommended")}</Typography>
              <Typography variant="title">{t("Settings_Personalization_MaterialYou_Title")}</Typography>
              <Typography variant="body1" color="textSecondary">
                {t("Settings_Personalization_MaterialYou_Description")}
              </Typography>
              <List.Trailing>
                <NativeSwitch
                  value={useMaterialYou}
                  onValueChange={(value) => {
                    mutateProperty("personalization", { useMaterialYou: value });
                  }}
                  disabled={typeof Platform.Version !== "number" || Platform.Version < 31}
                />
              </List.Trailing>
            </List.Item>
          )}
          <List.Item>
            <List.Leading>
              <Icon>
                <Papicons name={"ColorTheme"} />
              </Icon>
            </List.Leading>
            <Typography variant="title">{t("Settings_Personalization_Theme")}</Typography>
            <List.Trailing>
              <Stack bordered={true}
                direction={"horizontal"}
                height={40}
                hAlign={"center"}
                vAlign={"center"}
              >
                <AnimatedPressable onPress={() => {
                  setSelectedTheme("light");
                }}
                  style={{ overflow: "hidden", height: "100%" }}
                >
                  <Stack style={{ overflow: "hidden", paddingHorizontal: 15, height: "100%" }}
                    hAlign={"center"}
                    vAlign={"center"}
                    backgroundColor={selectedTheme === "light" ? theme.colors.primary : "transparent"}
                    radius={20}
                  >
                    <Papicons name={"Sun"}
                      opacity={selectedTheme === "light" ? 1 : 0.7}
                      color={selectedTheme === "light" ? "#FFF" : theme.colors.text}
                    />
                  </Stack>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => {
                  setSelectedTheme("dark");
                }}
                  style={{ overflow: "hidden", height: "100%" }}
                >
                  <Stack style={{ overflow: "hidden", paddingHorizontal: 15, height: "100%" }}
                    hAlign={"center"}
                    vAlign={"center"}
                    backgroundColor={selectedTheme === "dark" ? theme.colors.primary : "transparent"}
                    radius={20}
                  >
                    <Papicons name={"Moon"}
                      opacity={selectedTheme === "dark" ? 1 : 0.7}
                      color={selectedTheme === "dark" ? "#FFF" : theme.colors.text}
                    />
                  </Stack>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => {
                  setSelectedTheme("auto");
                }}
                  style={{ overflow: "hidden", height: "100%" }}
                >
                  <Stack style={{ overflow: "hidden", paddingHorizontal: 15, height: "100%" }}
                    hAlign={"center"}
                    vAlign={"center"}
                    backgroundColor={selectedTheme === "auto" ? theme.colors.primary : "transparent"}
                    radius={20}
                  >
                    <Typography color={selectedTheme === "auto" ? "#FFF" : theme.colors.text + "7F"}>Auto</Typography>
                  </Stack>
                </AnimatedPressable>
              </Stack>
            </List.Trailing>
          </List.Item>
          <List.Item>
            <List.Leading>
              <Icon>
                <Papicons name={"Palette"} />
              </Icon>
            </List.Leading>
            <Typography variant="title">Police</Typography>
            <Typography variant="body1" color="textSecondary">
              Modifier la police de caractères
            </Typography>
            <List.Trailing>
              <Picker
                options={FONT_OPTIONS.map(option => option.label)}
                selectedIndex={selectedFontIndex}
                onValueChange={(index) => {
                  const option = FONT_OPTIONS[index];
                  if (!option) return;
                  mutateProperty("personalization", { fontFamily: option.value });
                }}
              />
            </List.Trailing>
          </List.Item>
        </List.Section>

        <List.Section>
          <List.SectionTitle>
            <List.Label>Fond d&apos;écran</List.Label>
          </List.SectionTitle>
          <List.Item
            onPress={() => {
              router.push("/(modals)/wallpaper");
            }}
          >
            <List.Leading>
              <Icon>
                <Papicons name={"Palette"} />
              </Icon>
            </List.Leading>
            <Typography variant="title">Image de fond d&apos;accueil</Typography>
            <Typography variant="body1" color="textSecondary">
              {settingsStore.wallpaper?.gradient?.name ||
                (settingsStore.wallpaper?.type === "gradient"
                  ? "Dégradé personnalisé"
                  : settingsStore.wallpaper?.id?.startsWith("custom:")
                  ? "Image personnalisée"
                  : "Nuages Aether (Défaut)")}
            </Typography>
            <List.Trailing>
              <Icon>
                <Papicons name="ChevronRight" opacity={0.7} />
              </Icon>
            </List.Trailing>
          </List.Item>
        </List.Section>

        <List.Section>
          <List.SectionTitle>
            <List.Label>Options des matières</List.Label>
          </List.SectionTitle>
          <List.Item
            onPress={() => {
              router.push("/(settings)/subject_personalization");
            }}
          >
            <List.Leading>
              <Icon>
                <Papicons name={"PenAlt"} />
              </Icon>
            </List.Leading>
            <Typography variant="title">{t("Settings_Personalization_Subject_Title")}</Typography>
            <Typography variant="body1" color="textSecondary">
              {t("Settings_Personalization_Subject_Description")}
            </Typography>
            <List.Trailing>
              <Icon>
                <Papicons name="ChevronRight" opacity={0.7} />
              </Icon>
            </List.Trailing>
          </List.Item>
        </List.Section>

        <List.Section>
          <List.SectionTitle>
            <List.Label>Options de l'application</List.Label>
          </List.SectionTitle>
          <List.Item
            onPress={() => {
              router.push("/(settings)/tabs");
            }}
          >
            <List.Leading>
              <Icon>
                <Papicons name={"PapillonApp"} />
              </Icon>
            </List.Leading>
            <Typography variant={"title"}>{t("Settings_Tabs_Title")}</Typography>
            <Typography variant={"body1"}
              color={"textSecondary"}
            >{t("Settings_Tabs_Description")}</Typography>
            <List.Trailing>
              <Icon>
                <Papicons name="ChevronRight" opacity={0.7} />
              </Icon>
            </List.Trailing>
          </List.Item>
          <List.Item>
            <List.Leading>
              <Icon>
                <Papicons name={"User"} />
              </Icon>
            </List.Leading>
            <Typography variant={"title"}>Masquer mon nom sur l&apos;accueil</Typography>
            <Typography variant={"body1"} color={"textSecondary"}>
              Préserve votre anonymat lors de l&apos;ouverture de l&apos;application
            </Typography>
            <List.Trailing>
              <NativeSwitch
                value={settingsStore.hideNameOnHomeScreen ?? false}
                onValueChange={(val) => {
                  mutateProperty("personalization", { hideNameOnHomeScreen: val });
                }}
              />
            </List.Trailing>
          </List.Item>
          <List.Item>
            <List.Leading>
              <Icon>
                <Papicons name={"Calendar"} />
              </Icon>
            </List.Leading>
            <Typography variant={"title"}>Afficher le week-end sur les cours</Typography>
            <Typography variant={"body1"} color={"textSecondary"}>
              Affiche le samedi et le dimanche dans l&apos;emploi du temps
            </Typography>
            <List.Trailing>
              <NativeSwitch
                value={settingsStore.showWeekendsOnTimetable ?? false}
                onValueChange={(val) => {
                  mutateProperty("personalization", { showWeekendsOnTimetable: val });
                }}
              />
            </List.Trailing>
          </List.Item>
          <List.Item
            onPress={() => {
              router.push("/(settings)/language");
            }}
          >
            <List.Leading>
              <Icon>
                <Papicons name={"MapPin"} />
              </Icon>
            </List.Leading>
            <Typography variant={"title"}>{t("Settings_Language_Title")}</Typography>
            <Typography variant={"body1"}
              color={"textSecondary"}
            >{t("Settings_Language_Description")}</Typography>
            <List.Trailing>
              <Icon>
                <Papicons name="ChevronRight" opacity={0.7} />
              </Icon>
            </List.Trailing>
          </List.Item>
          <List.Item
            onPress={() => {
              setTempApiUrl(settingsStore.pronoteApiUrl || "");
              setShowApiUrlModal(true);
            }}
          >
            <List.Leading>
              <Icon>
                <EarthIcon size={20} color={theme.colors.text} />
              </Icon>
            </List.Leading>
            <Typography variant={"title"}>Serveur API Pronote</Typography>
            <Typography variant={"body1"} color={"textSecondary"}>
              {settingsStore.pronoteApiUrl || "URL Vercel par défaut"}
            </Typography>
            <List.Trailing>
              <Icon>
                <Papicons name="ChevronRight" opacity={0.7} />
              </Icon>
            </List.Trailing>
          </List.Item>
        </List.Section>
      </List>

      <Modal
        visible={showApiUrlModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApiUrlModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 20, padding: 22, width: "100%", maxWidth: 420, gap: 14 }}>
            <Typography variant="h3">Serveur API Pronote</Typography>
            <Typography variant="body1" color="textSecondary">
              Indiquez l&apos;URL de votre microservice Vercel (pronotepy).
            </Typography>
            <TextInput
              value={tempApiUrl}
              onChangeText={setTempApiUrl}
              placeholder="https://votre-projet.vercel.app"
              placeholderTextColor={theme.colors.text + "60"}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 12,
                padding: 12,
                color: theme.colors.text,
                fontSize: 15,
                backgroundColor: theme.colors.background,
              }}
            />
            <Stack direction="horizontal" gap={10} style={{ justifyContent: "flex-end", marginTop: 8 }}>
              <Button
                label="Réinitialiser"
                variant="text"
                onPress={() => {
                  mutateProperty("personalization", { pronoteApiUrl: undefined });
                  setShowApiUrlModal(false);
                }}
              />
              <Button
                label="Enregistrer"
                variant="primary"
                onPress={() => {
                  mutateProperty("personalization", { pronoteApiUrl: tempApiUrl.trim() || undefined });
                  setShowApiUrlModal(false);
                }}
              />
            </Stack>
          </View>
        </View>
      </Modal>
    </>
  )
};

export default PersonalizationSettings;
