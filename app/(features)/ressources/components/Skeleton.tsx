import React from "react";
import { View } from "react-native";
import { useTheme } from "expo-router/react-navigation";

import { Dynamic } from "@/ui/components/Dynamic";
import { AetherAppearIn, AetherAppearOut } from "@/ui/utils/Transition";

function GhostBlock({
  width,
  height,
  radius,
}: {
  width: string | number;
  height: number;
  radius: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: width as never,
        height,
        borderRadius: radius,
        backgroundColor: `${String(colors.text)}0D`,
      }}
    />
  );
}

/** Skeleton premier paint (même langage que le reste de l'app :
 *  blocs fantômes teintés, pas de spinner plein écran). */
export function RessourcesSkeleton() {
  const { colors } = useTheme();
  return (
    <Dynamic animated entering={AetherAppearIn} exiting={AetherAppearOut}>
      <View style={{ gap: 12, padding: 16 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 14,
              gap: 8,
              overflow: "hidden",
            }}
          >
            <GhostBlock width="55%" height={20} radius={6} />
            <GhostBlock width="40%" height={14} radius={6} />
            <GhostBlock width="100%" height={52} radius={10} />
            <GhostBlock width="70%" height={36} radius={10} />
          </View>
        ))}
      </View>
    </Dynamic>
  );
}

/** Skeleton carte accueil (2 lignes fantômes, compact). */
export function LessonContentSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: "100%",
        paddingHorizontal: 10,
        paddingBottom: 12,
      }}
    >
      <View style={{ gap: 8 }}>
        <GhostBlock width="70%" height={20} radius={6} />
        <GhostBlock width="100%" height={64} radius={14} />
        <GhostBlock width="100%" height={64} radius={14} />
      </View>
    </View>
  );
}

export default RessourcesSkeleton;
