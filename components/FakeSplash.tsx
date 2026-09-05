import { SplashScreen } from "expo-router";
import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export const AetherSplashOut = () => {
  "worklet";
  return {
    initialValues: {
      opacity: 1,
      transform: [{ scale: 1 }],
    },
    animations: {
      opacity: withDelay(
        50,
        withTiming(0, {
          duration: 350,
          easing: Easing.out(Easing.ease),
        })
      ),
      transform: [
        {
          scale: withDelay(
            50,
            withTiming(1.04, {
              duration: 350,
              easing: Easing.out(Easing.ease),
            })
          ),
        },
      ],
    },
  };
};

const FakeSplash = ({
  isAppReady,
  instant,
}: {
  isAppReady: boolean;
  instant?: boolean;
}) => {
  const logoScale = useSharedValue(0.85);
  const logoOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.35);
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    // Logo entrance
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    logoOpacity.value = withTiming(1, { duration: 400 });

    // Subtle glow pulsing
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Indeterminate progress bar
    progressWidth.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.85, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const progressAnimStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  if (instant && isAppReady) {
    SplashScreen.hideAsync();
    return null;
  }

  return (
    <Reanimated.View style={styles.container} exiting={AetherSplashOut}>
      {/* Background radial glow */}
      <Reanimated.View style={[styles.glowCircle, glowAnimStyle]} />

      {/* Main logo and branding */}
      <Reanimated.View style={[styles.content, logoAnimStyle]}>
        <View style={styles.iconContainer}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.icon}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.appName}>AETHER</Text>
        <Text style={styles.appSubtitle}>Pronote pour Android</Text>
      </Reanimated.View>

      {/* Bottom loader */}
      <View style={styles.bottomBarContainer}>
        <View style={styles.progressBarTrack}>
          <Reanimated.View style={[styles.progressBarFill, progressAnimStyle]} />
        </View>
      </View>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...(StyleSheet.absoluteFill as any),
    zIndex: 9999,
    backgroundColor: "#111A17",
    alignItems: "center",
    justifyContent: "center",
  },
  glowCircle: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#29947A",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconContainer: {
    width: 104,
    height: 104,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(41, 148, 122, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(41, 148, 122, 0.3)",
    marginBottom: 6,
    overflow: "hidden",
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 4,
  },
  appSubtitle: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  bottomBarContainer: {
    position: "absolute",
    bottom: 50,
    width: 140,
    alignItems: "center",
  },
  progressBarTrack: {
    width: "100%",
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#29947A",
    borderRadius: 1.5,
  },
});

export default FakeSplash;