import { Papicons } from "@getpapillon/papicons";
import React, { memo } from "react";
import { TouchableOpacity } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "expo-router/react-navigation";

import { Dynamic } from "@/ui/components/Dynamic";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import { AetherAppearIn, AetherAppearOut } from "@/ui/utils/Transition";

interface RessourcesDayHeaderProps {
  title: string;
  subtitle?: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

/** En-tête de jour (même langage que tasks/atoms/DateHeader) :
 *  chevron animé 350 ms, état replié atténué. */
const RessourcesDayHeader = memo(
  ({ title, subtitle, isCollapsed, onToggle }: RessourcesDayHeaderProps) => {
    const { colors } = useTheme();
    const papillonEasing = Easing.bezier(0.3, 0.3, 0, 1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        {
          rotate: withTiming(isCollapsed ? "-90deg" : "0deg", {
            duration: 350,
            easing: papillonEasing,
          }),
        },
      ],
      marginLeft: "auto",
    }));

    return (
      <Dynamic
        animated
        key={`ressources-day:${title}`}
        entering={AetherAppearIn}
        exiting={AetherAppearOut}
      >
        <TouchableOpacity onPress={onToggle} activeOpacity={0.6}>
          <Stack
            direction="horizontal"
            gap={8}
            vAlign="center"
            hAlign="center"
            padding={[6, 10]}
            style={{ width: "100%", opacity: isCollapsed ? 0.6 : 1 }}
          >
            <Typography
              variant="h4"
              color="text"
              style={{ textTransform: "capitalize" }}
              numberOfLines={1}
            >
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" color="secondary" numberOfLines={1}>
                {subtitle}
              </Typography>
            ) : null}
            <Reanimated.View style={animatedStyle}>
              <Papicons
                name="ChevronDown"
                size={20}
                color={String(colors.text)}
                style={{ opacity: 0.6 }}
              />
            </Reanimated.View>
          </Stack>
        </TouchableOpacity>
      </Dynamic>
    );
  }
);

RessourcesDayHeader.displayName = "RessourcesDayHeader";

export default RessourcesDayHeader;
