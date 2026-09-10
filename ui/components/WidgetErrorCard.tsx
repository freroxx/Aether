import { useTheme } from "expo-router/react-navigation";
import { Papicons } from "@getpapillon/papicons";
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/ui/components/Button";
import Icon from "@/ui/components/Icon";
import Typography from "@/ui/components/Typography";

type WidgetErrorCardProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export const WidgetErrorCard = memo(
  ({ title, message, onRetry }: WidgetErrorCardProps) => {
    const { colors } = useTheme();
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Icon papicon opacity={0.5} size={28}>
          <Papicons name="AlertTriangle" />
        </Icon>
        <Typography variant="title" align="center">
          {title ?? "Impossible de charger"}
        </Typography>
        {message ? (
          <Typography variant="body2" color="secondary" align="center">
            {message}
          </Typography>
        ) : null}
        {onRetry ? (
          <View style={styles.buttonWrap}>
            <Button title="Réessayer" onPress={onRetry} inline size="small" />
          </View>
        ) : null}
      </View>
    );
  }
);

WidgetErrorCard.displayName = "WidgetErrorCard";

export default WidgetErrorCard;

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 16,
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonWrap: {
    marginTop: 8,
  },
});
