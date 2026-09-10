/**
 * Phase 2 design system foundations.
 * Tokens only — no behavior change.
 * Aesthetics: teal #29947A, sn-pro, M3, radius 20.
 */

export const Spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
} as const;

export type SpacingKey = keyof typeof Spacing;
export type SpacingValue = (typeof Spacing)[SpacingKey];

export const Radius = {
  card: 20,
  sheet: 28,
  button: 50,
  chip: 16,
} as const;

export type RadiusKey = keyof typeof Radius;
export type RadiusValue = (typeof Radius)[RadiusKey];

export const SemanticColors = {
  success: "#2E9E6B",
  warning: "#D98A00",
  error: "#DC1400",
  info: "#29947A",
} as const;

export type SemanticColorKey = keyof typeof SemanticColors;
export type SemanticColorValue = (typeof SemanticColors)[SemanticColorKey];

export const Shadows = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sheet: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  button: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
} as const;

export type ShadowKey = keyof typeof Shadows;
export type ShadowValue = (typeof Shadows)[ShadowKey];

export const TouchTarget = {
  min: 44,
} as const;

export type TouchTargetKey = keyof typeof TouchTarget;
export type TouchTargetValue = (typeof TouchTarget)[TouchTargetKey];

export const Animation = {
  spring: {
    mass: 1,
    damping: 20,
    stiffness: 300,
  },
  duration: {
    fast: 150,
    normal: 300,
  },
} as const;

export type AnimationSpring = typeof Animation.spring;
export type AnimationDuration = typeof Animation.duration;
