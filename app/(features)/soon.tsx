import Icon from "@/ui/components/Icon";
import MaterialIcon from "@/ui/components/MaterialIcon";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import React from "react";
import { Linking, View } from "react-native";

export default function Soon() {
  return (
    <View
      style={{
        padding: 20,
        paddingBottom: 0,
      }}
    >
      <Stack
        padding={20}
        gap={10}
        vAlign="center"
        hAlign="center"
      >
        <Icon size={42}>
          <MaterialIcon name="schedule" size={42} color="#1B8A6B" />
        </Icon>
        <Typography variant="h2" align="center">
          Promis, ça arrive (vraiment) bientôt !
        </Typography>
        <Typography variant="body1" color="secondary" align="center">
          L'onglet est toujours en cours de développement. Il arrivera prochainement dans une version future de Aether.
        </Typography>
        <Typography variant="body1" color="primary" align="center" onPress={() => {
          Linking.openURL("https://github.com/aether-app/");
        }} style={{
          textDecorationLine: "underline",
        }}>
          Et pour rester au courant, tu peux suivre le projet sur GitHub !
        </Typography>
      </Stack>
    </View>
  );
}