import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleProp, TextStyle } from "react-native";

export type MaterialIconName = React.ComponentProps<
  typeof MaterialIcons
>["name"];

interface MaterialIconProps {
  name: MaterialIconName;
  size?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  color?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fill?: any;
  opacity?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Aether icon wrapper (Material 3, Android-only).
 * Use this instead of Papicons/Lucide for all new or touched screens.
 * Backed by @expo/vector-icons MaterialIcons (bundled font, no native link).
 * NOTE: @expo/material-symbols ships XML assets only (no JS component),
 * so it cannot be imported from JS — hence this wrapper.
 */
export default function MaterialIcon({
  name,
  size = 24,
  color,
  fill,
  opacity,
  style,
}: MaterialIconProps) {
  const flattened = (Array.isArray(style) ? style : [style]).filter(Boolean);
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={color ?? fill}
      style={[{ opacity }, ...flattened] as StyleProp<TextStyle>}
    />
  );
}
