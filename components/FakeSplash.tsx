import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const AetherSplashOut = () => {
  "worklet";
  return {
    initialValues: {
      opacity: 1,
      transform: [{ scale: 1 }],
    },
    animations: {
      opacity: withTiming(0, {
        duration: 380,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
      transform: [
        {
          scale: withTiming(1.06, {
            duration: 380,
            easing: Easing.bezier(0.05, 0.7, 0.1, 1),
          }),
        },
      ],
    },
  };
};

const FakeSplash = ({
  isAppReady,
  instant = false,
}: {
  isAppReady: boolean;
  instant?: boolean;
}) => {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // M3 Expressive Shared Values
  const logoScale = useSharedValue(0.65);
  const logoOpacity = useSharedValue(0);
  const logoRotation = useSharedValue(-6);

  const textTranslateY = useSharedValue(24);
  const textOpacity = useSharedValue(0);

  const badgeTranslateY = useSharedValue(16);
  const badgeOpacity = useSharedValue(0);

  const ambientGlowScale = useSharedValue(0.9);
  const ambientGlowOpacity = useSharedValue(0.25);

  const loaderTranslateX = useSharedValue(-SCREEN_WIDTH * 0.4);
  const loaderScaleX = useSharedValue(0.3);

  // Dismiss native splash as soon as component mounts
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    // Ensure at least 650ms presentation for fluid perception
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, instant ? 150 : 650);

    return () => clearTimeout(timer);
  }, [instant]);

  // Entrance Animations
  useEffect(() => {
    // 1. Logo container spring bounce (M3 expressive elastic overshoot)
    logoScale.value = withDelay(
      60,
      withSpring(1, {
        damping: 11,
        stiffness: 95,
        mass: 0.9,
      })
    );
    logoOpacity.value = withDelay(
      60,
      withTiming(1, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      })
    );
    logoRotation.value = withDelay(
      60,
      withSpring(0, {
        damping: 14,
        stiffness: 100,
      })
    );

    // 2. Ambient radial aura breathing loop
    ambientGlowScale.value = withRepeat(
      withSequence(
        withTiming(1.35, {
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0.9, {
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      true
    );

    ambientGlowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.55, {
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0.25, {
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      true
    );

    // 3. Typography staggered entrance
    textTranslateY.value = withDelay(
      220,
      withSpring(0, {
        damping: 14,
        stiffness: 110,
      })
    );
    textOpacity.value = withDelay(
      220,
      withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.quad),
      })
    );

    // 4. Subtitle / Badge staggered entrance
    badgeTranslateY.value = withDelay(
      360,
      withSpring(0, {
        damping: 15,
        stiffness: 110,
      })
    );
    badgeOpacity.value = withDelay(
      360,
      withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.quad),
      })
    );

    // 5. M3 Expressive Indeterminate Progress Bar loop
    loaderTranslateX.value = withRepeat(
      withSequence(
        withTiming(SCREEN_WIDTH * 0.4, {
          duration: 1100,
          easing: Easing.bezier(0.2, 0, 0, 1),
        }),
        withTiming(-SCREEN_WIDTH * 0.4, {
          duration: 0,
        })
      ),
      -1,
      false
    );

    loaderScaleX.value = withRepeat(
      withSequence(
        withTiming(0.75, {
          duration: 550,
          easing: Easing.bezier(0.3, 0, 0.2, 1),
        }),
        withTiming(0.25, {
          duration: 550,
          easing: Easing.bezier(0.1, 0, 0.3, 1),
        })
      ),
      -1,
      true
    );
  }, []);

  // Exit trigger
  useEffect(() => {
    if (isAppReady && minTimeElapsed) {
      setIsDone(true);
    }
  }, [isAppReady, minTimeElapsed]);

  // Animated Styles
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotation.value}deg` },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeTranslateY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: ambientGlowOpacity.value,
    transform: [{ scale: ambientGlowScale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: loaderTranslateX.value },
      { scaleX: loaderScaleX.value },
    ],
  }));

  if (isDone) {
    return null;
  }

  return (
    <Reanimated.View style={styles.container} exiting={AetherSplashOut}>
      {/* Dynamic Ambient Glow Layer */}
      <Reanimated.View style={[styles.glowAura, glowStyle]} />
      <View style={styles.decorativeOrb1} />
      <View style={styles.decorativeOrb2} />

      {/* Center Hero Content */}
      <View style={styles.heroWrapper}>
        {/* App Icon Container */}
        <Reanimated.View style={[styles.iconCard, logoStyle]}>
          <View style={styles.iconInnerFrame}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>
        </Reanimated.View>

        {/* Title */}
        <Reanimated.View style={[styles.textWrapper, textStyle]}>
          <Text style={styles.appName}>AETHER</Text>
        </Reanimated.View>

        {/* M3 Expressive Pill Badge */}
        <Reanimated.View style={[styles.badgePill, badgeStyle]}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Pronote · Espace Élève & Parent</Text>
        </Reanimated.View>
      </View>

      {/* Bottom M3 Expressive Indeterminate Progress Indicator */}
      <View style={styles.bottomLoaderContainer}>
        <View style={styles.loaderTrack}>
          <Reanimated.View style={[styles.loaderPill, progressStyle]} />
        </View>
      </View>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...(StyleSheet.absoluteFill as any),
    zIndex: 9999,
    backgroundColor: "#0D1512",
    alignItems: "center",
    justifyContent: "center",
  },
  glowAura: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#29947A",
    filter: "blur(60px)",
  },
  decorativeOrb1: {
    position: "absolute",
    top: "16%",
    right: "12%",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(78, 219, 189, 0.08)",
  },
  decorativeOrb2: {
    position: "absolute",
    bottom: "20%",
    left: "10%",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(41, 148, 122, 0.07)",
  },
  heroWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconCard: {
    width: 112,
    height: 112,
    borderRadius: 34,
    backgroundColor: "#13231E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(78, 219, 189, 0.28)",
    shadowColor: "#29947A",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    marginBottom: 20,
  },
  iconInnerFrame: {
    width: 96,
    height: 96,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconImage: {
    width: 86,
    height: 86,
    borderRadius: 22,
  },
  textWrapper: {
    alignItems: "center",
    marginBottom: 10,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 6,
    fontFamily: "System",
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(41, 148, 122, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(78, 219, 189, 0.22)",
    gap: 7,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4EDBBD",
  },
  badgeText: {
    color: "#E0F5EE",
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  bottomLoaderContainer: {
    position: "absolute",
    bottom: 56,
    width: 150,
    alignItems: "center",
  },
  loaderTrack: {
    width: "100%",
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderPill: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "#4EDBBD",
    borderRadius: 2,
  },
});

export default FakeSplash;