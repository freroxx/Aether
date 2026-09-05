import { Easing, FadeInUp, FadeOut } from "react-native-reanimated";

const SPRING_CONFIG = { mass: 1, damping: 20, stiffness: 300 };

type AnimationStyle = "default" | "spring" | "list" | "smooth" | "fade";

const AetherSpring = (a: any) =>
  a?.springify().mass(SPRING_CONFIG.mass).damping(SPRING_CONFIG.damping).stiffness(SPRING_CONFIG.stiffness);

const AetherList = (a: any) =>
  a?.duration(300).easing(Easing.out(Easing.exp));

const AetherReanimatedSpring = (a: any) =>
  a?.springify({ duration: 300 });

const AetherFade = {
  in: FadeInUp.duration(200).easing(Easing.out(Easing.ease)).withInitialValues({
    opacity: 0,
  }),
  out: FadeOut.duration(150).easing(Easing.in(Easing.ease)),
};

export const Animation = (animation?: any, style?: AnimationStyle) => {
  switch (style) {
  case "spring":
    return AetherSpring(animation);
  case "list":
    return AetherList(animation);
  case "smooth":
    return AetherReanimatedSpring(animation);
  default:
    return AetherSpring(animation);
  }
};

export const AetherFadeIn = AetherFade.in;
export const AetherFadeOut = AetherFade.out;
