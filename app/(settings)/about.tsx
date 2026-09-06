import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import { Github, ShieldCheck } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import packageJson from "@/package.json";
import { useSettingsStore } from "@/stores/settings";
import Avatar from "@/ui/components/Avatar";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";

export default function SettingsAbout() {
  const theme = useTheme();
  const { colors, dark } = theme;
  const insets = useSafeAreaInsets();

  const settingsStore = useSettingsStore(state => state.personalization);
  const mutateProperty = useSettingsStore(state => state.mutateProperty);

  const [tapCount, setTapCount] = useState(0);

  const handleVersionTap = () => {
    setTapCount(prev => prev + 1);

    if (tapCount + 1 >= 7) {
      setTapCount(0);
      if (settingsStore.showDevMode) {
        Alert.alert("Mode développeur", "Mode développeur désactivé.");
        mutateProperty("personalization", { showDevMode: false });
      } else {
        Alert.alert("Mode développeur", "Mode développeur activé ! Un nouvel onglet est apparu dans les réglages.");
        mutateProperty("personalization", { showDevMode: true });
      }
    }
  };

  return (
    <List
      style={{ flex: 1 }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: insets.bottom + 24,
        gap: 16,
      }}
      contentInsetAdjustmentBehavior="always"
    >
      {/* Hero Header Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: dark ? "rgba(41, 148, 122, 0.14)" : "rgba(41, 148, 122, 0.09)",
            borderColor: dark ? "rgba(41, 148, 122, 0.3)" : "rgba(41, 148, 122, 0.2)",
          },
        ]}
      >
        <View style={styles.heroLogoContainer}>
          <Avatar
            size={68}
            initials="AE"
            shape="square"
            imageUrl="https://github.com/freroxx.png"
          />
        </View>

        <Typography variant="h2" weight="bold" align="center">
          Aether
        </Typography>

        <Typography
          variant="body1"
          color="textSecondary"
          align="center"
          style={{ maxWidth: 320, lineHeight: 22 }}
        >
          Fork moderne et indépendant de Papillon, exclusivement pensé pour Pronote et optimisé pour Android.
        </Typography>
      </View>

      {/* Community and links */}
      <List.Section>
        <List.SectionTitle>
          <List.Label>Code source & Communauté</List.Label>
        </List.SectionTitle>

        <List.Item
          onPress={() => Linking.openURL("https://github.com/freroxx/Aether")}
        >
          <List.Leading>
            <View style={styles.iconCircle}>
              <Github size={20} color={colors.text} />
            </View>
          </List.Leading>
          <Typography variant="title" weight="bold">
            Dépôt GitHub
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Code source du projet
          </Typography>
          <List.Trailing>
            <Papicons name="ChevronRight" opacity={0.5} size={20} />
          </List.Trailing>
        </List.Item>
      </List.Section>

      {/* Version and system info */}
      <List.Section>
        <List.SectionTitle>
          <List.Label>Informations</List.Label>
        </List.SectionTitle>

        <List.Item onPress={handleVersionTap}>
          <List.Leading>
            <View style={styles.iconCircle}>
              <Papicons name="Butterfly" size={20} />
            </View>
          </List.Leading>
          <Typography variant="title" weight="bold">
            Version d&apos;Aether
          </Typography>
          <Typography variant="body1" color="textSecondary">
            v{packageJson.version} {tapCount > 0 && tapCount < 7 ? `(${7 - tapCount} taps restants)` : ""}
          </Typography>
        </List.Item>

        <List.Item
          onPress={() => Linking.openURL("https://github.com/freroxx/Aether/blob/main/privacy.md")}
        >
          <List.Leading>
            <View style={styles.iconCircle}>
              <ShieldCheck size={20} color="#29947A" />
            </View>
          </List.Leading>
          <Typography variant="title" weight="bold">
            Politique de confidentialité
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Zéro pistage, chiffrement local et respect de votre vie privée
          </Typography>
          <List.Trailing>
            <Papicons name="ChevronRight" opacity={0.5} size={20} />
          </List.Trailing>
        </List.Item>

        <List.Item>
          <List.Leading>
            <View style={styles.iconCircle}>
              <Papicons name="Code" size={20} />
            </View>
          </List.Leading>
          <Typography variant="title" weight="bold">
            Environnement
          </Typography>
          <Typography variant="body1" color="textSecondary">
            React Native {packageJson.dependencies?.["react-native"]} · Expo {packageJson.dependencies?.expo}
          </Typography>
        </List.Item>
      </List.Section>
    </List>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 26,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
  },
  heroLogoContainer: {
    marginBottom: 4,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
