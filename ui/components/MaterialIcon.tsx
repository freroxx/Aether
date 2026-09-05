import { MaterialSymbols } from "@expo/material-symbols";
import React from "react";
import { StyleProp, TextStyle } from "react-native";

export type MaterialIconName = React.ComponentProps<
  typeof MaterialSymbols
>["name"];

interface MaterialIconProps {
  name: MaterialIconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Aether icon wrapper (Material 3 Expressive, Android-only).
 * Use this instead of Papicons/Lucide for all new or touched screens.
 * Name mapping examples: Papicons "Sparkles" -> "sparkles",
 * "Cross" -> "close", "clock" -> "schedule", "Check" -> "check".
 */
export default function MaterialIcon({
  name,
  size = 24,
  color,
  style,
}: MaterialIconProps) {
  return (
    <MaterialSymbols
      name={name}
      size={size}
      color={color}
      style={style}
    />
  );
}
