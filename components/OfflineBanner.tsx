import { Papicons } from "@getpapillon/papicons";
import { useTheme } from "expo-router/react-navigation";
import React, { memo, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

import Typography from "@/ui/components/Typography";
import { getCachedNetworkState, hasInternet } from "@/services/shared/network";

type OfflineBannerProps = {
  topInset?: number;
};

/**
 * Thin offline banner — offline-first UX.
 * Shows cached-data notice instead of silent failure.
 * No new design language: uses card color + warning tint.
 */
export const OfflineBanner = memo(({ topInset = 0 }: OfflineBannerProps) => {
  const { colors } = useTheme();
  const [isOffline, setIsOffline] = useState(
    () => getCachedNetworkState() === false
  );

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const online = await hasInternet();
        if (mounted) setIsOffline(!online);
      } catch {
        if (mounted) setIsOffline(false);
      }
    };
    void check();
    const timer = setInterval(check, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.wrapper, { top: topInset }]}
    >
      <View
        style={[
          styles.pill,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Papicons name="WifiOff" size={16} />
        <Typography variant="caption" color="secondary">
          Hors-ligne — données en cache
        </Typography>
      </View>
    </Animated.View>
  );
});

OfflineBanner.displayName = "OfflineBanner";

export default OfflineBanner;

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
    alignItems: "center",
    pointerEvents: "none",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 1,
  },
});
