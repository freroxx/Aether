import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import Typography from "@/ui/components/Typography";
import Button from "@/ui/new/Button";

export function Pronote2FAModal({ setChallengeModalVisible }: { setChallengeModalVisible?: (visible: boolean) => void }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
      <Typography variant="h3">Double authentification non requise</Typography>
      <Typography variant="body1" color="textSecondary" style={{ marginTop: 8, textAlign: "center" }}>
        La connexion avec Pronotepy gère la double authentification directement lors de la connexion.
      </Typography>
      <Button
        label="Retour"
        variant="primary"
        style={{ marginTop: 24 }}
        onPress={() => {
          if (setChallengeModalVisible) setChallengeModalVisible(false);
          router.back();
        }}
      />
    </View>
  );
}

export default function Pronote2FAScreen() {
  return <Pronote2FAModal />;
}
