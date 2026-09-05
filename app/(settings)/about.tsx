import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import { useRouter } from "expo-router";
import { Github, Heart, Info, Lock, ShieldCheck, Sparkles } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import packageJson from "@/package.json";
import { useSettingsStore } from "@/stores/settings";
import Avatar from "@/ui/components/Avatar";
import Icon from "@/ui/components/Icon";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";
import { getInitials } from "@/utils/chats/initials";

export default function SettingsAbout() {
  const theme = useTheme();
  const { colors, dark } = theme;
  const router = useRouter();
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

        {/* Feature Badges Row */}
        <View style={styles.badgeRow}>
          <View style={[styles.pillBadge, { backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
            <ShieldCheck size={14} color="#29947A" />
            <Typography variant="caption" weight="bold" style={{ color: "#29947A" }}>
              100% FOSS
            </Typography>
          </View>

          <View style={[styles.pillBadge, { backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
            <Lock size={14} color="#29947A" />
            <Typography variant="caption" weight="bold" style={{ color: "#29947A" }}>
              Zéro pistage
            </Typography>
          </View>

          <View style={[styles.pillBadge, { backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
            <Sparkles size={14} color="#29947A" />
            <Typography variant="caption" weight="bold" style={{ color: "#29947A" }}>
              Pronote-only
            </Typography>
          </View>
        </View>
      </View>

      {/* Team section */}
      <List.Section>
        <List.SectionTitle>
          <List.Label>Équipe Aether</List.Label>
        </List.SectionTitle>

        <List.Item onPress={() => Linking.openURL("https://github.com/freroxx")}>
          <List.Leading>
            <Avatar
              size={42}
              shape="square"
              initials="FX"
              imageUrl="https://github.com/freroxx.png"
            />
          </List.Leading>
          <Typography variant="title" weight="bold">
            Frerox
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Créateur & Mainteneur principal (@freroxx)
          </Typography>
          <List.Trailing>
            <Github size={20} color={colors.text} style={{ opacity: 0.6 }} />
          </List.Trailing>
        </List.Item>
      </List.Section>

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
            Consulter le code source, signaler un bug ou contribuer
          </Typography>
          <List.Trailing>
            <Papicons name="ChevronRight" opacity={0.5} size={20} />
          </List.Trailing>
        </List.Item>

        <List.Item
          onPress={() => Linking.openURL("https://github.com/freroxx/Aether/issues")}
        >
          <List.Leading>
            <View style={styles.iconCircle}>
              <Info size={20} color={colors.text} />
            </View>
          </List.Leading>
          <Typography variant="title" weight="bold">
            Signaler un problème
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Proposer une amélioration ou rapporter un dysfonctionnement
          </Typography>
          <List.Trailing>
            <Papicons name="ChevronRight" opacity={0.5} size={20} />
          </List.Trailing>
        </List.Item>

        <List.Item
          onPress={() => router.push("/(settings)/contributors")}
        >
          <List.Leading>
            <View style={styles.iconCircle}>
              <Heart size={20} color="#E05D34" />
            </View>
          </List.Leading>
          <Typography variant="title" weight="bold">
            Contributeurs
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Remerciements aux personnes qui aident le projet
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
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  pillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
