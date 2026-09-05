import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Brain,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lightbulb,
  Lock,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react-native";
import LinearGradient from "react-native-linear-gradient";

import MaterialIcon, { MaterialIconName } from "@/ui/components/MaterialIcon";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";

interface RoadmapCardItem {
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
}

const ROADMAP: RoadmapCardItem[] = [
  {
    icon: <Lightbulb size={22} color="#DD007D" />,
    title: "Pistes de réflexion méthodologiques",
    badge: "Bientôt",
    badgeColor: "#DD007D",
    description:
      "Des conseils et pistes de réflexion pour vous débloquer sur un devoir, sans jamais donner de réponses toutes faites.",
  },
  {
    icon: <CalendarCheck size={22} color="#8500dd" />,
    title: "Synthèse & Clarté des cours",
    badge: "En cours",
    badgeColor: "#8500dd",
    description:
      "Reformulation simple et explications pas-à-pas de notions complexes pour réviser efficacement.",
  },
  {
    icon: <Brain size={22} color="#0059DD" />,
    title: "Flashcards & Fiches de révision",
    badge: "Prévu",
    badgeColor: "#0059DD",
    description:
      "Génération automatique de questions d'entraînement et quiz à partir de vos matières scolaires.",
  },
  {
    icon: <Zap size={22} color="#29947A" />,
    title: "Modèles libres sur le cloud",
    badge: "Actif",
    badgeColor: "#29947A",
    description:
      "Utilisation de modèles open-source hébergés gratuitement dans le cloud, sans aucun abonnement ni publicité.",
  },
];

export default function ZenScreen() {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

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
      {/* Hero card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: dark ? "rgba(221, 0, 125, 0.12)" : "rgba(221, 0, 125, 0.08)",
            borderColor: dark ? "rgba(221, 0, 125, 0.3)" : "rgba(221, 0, 125, 0.2)",
          },
        ]}
      >
        <LinearGradient
          colors={["#DD007D", "#8500dd"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroIconCircle}
        >
          <MaterialIcon name="auto-awesome" size={32} color="#FFFFFF" />
        </LinearGradient>

        <Typography variant="h2" weight="bold" align="center">
          OpenCode Zen
        </Typography>

        <Typography
          variant="body1"
          color="textSecondary"
          align="center"
          style={{ maxWidth: 320, lineHeight: 22 }}
        >
          L&apos;assistant pédagogique ouvert d&apos;Aether, utilisant des modèles libres dans le cloud pour vous accompagner dans vos études.
        </Typography>
      </View>

      {/* Privacy Pledge Card */}
      <View style={[styles.pledgeCard, { backgroundColor: colors.card }]}>
        <View style={styles.pledgeHeader}>
          <Shield size={20} color="#29947A" />
          <Typography variant="title" weight="bold" style={{ color: "#29947A", flex: 1 }}>
            Modèles libres &amp; Transparence
          </Typography>
        </View>

        <Typography variant="body2" color="textSecondary" style={{ lineHeight: 20 }}>
          OpenCode Zen s&apos;appuie sur des modèles d&apos;IA ouverts hébergés gratuitement sur le cloud. Vos requêtes scolaires sont traitées sans profilage commercial, sans publicité et sans revente de vos données.
        </Typography>
      </View>

      {/* Roadmap section */}
      <List.Section>
        <List.SectionTitle>
          <List.Label>Fonctionnalités en préparation</List.Label>
        </List.SectionTitle>

        {ROADMAP.map(item => (
          <View
            key={item.title}
            style={[styles.featureCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.featureTopRow}>
              <View
                style={[
                  styles.featureIconContainer,
                  { backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
                ]}
              >
                {item.icon}
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="title" weight="bold">
                  {item.title}
                </Typography>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: item.badgeColor + "20" },
                ]}
              >
                <Typography
                  variant="caption"
                  weight="bold"
                  style={{ color: item.badgeColor, fontSize: 11 }}
                >
                  {item.badge}
                </Typography>
              </View>
            </View>

            <Typography
              variant="body2"
              color="textSecondary"
              style={{ lineHeight: 19, paddingLeft: 46 }}
            >
              {item.description}
            </Typography>
          </View>
        ))}
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
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#DD007D",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  pledgeCard: {
    borderRadius: 20,
    padding: 16,
    gap: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  pledgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureCard: {
    borderRadius: 20,
    padding: 16,
    gap: 8,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  featureTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
});
