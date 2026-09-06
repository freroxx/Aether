import { useHeaderHeight, useRoute } from "expo-router/react-navigation";
import { useNavigation } from "expo-router";
import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Search from "@/ui/components/Search";
import Stack from "@/ui/components/Stack";
import Button from "@/ui/new/Button";
import Divider from "@/ui/new/Divider";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";

const PronoteSearchHeader = memo(({
  accountType,
}: {
  accountType?: string;
}) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [url, setUrl] = React.useState("");

  const submitURL = () => {
    if (url.trim().length === 0) {return;}
    navigation.navigate("credentials", { url, accountType });
  };

  const urlValid = url.trim().length > 0 && (url.startsWith("http://") || url.startsWith("https://"));

  return (
    <Stack padding={[4, 0]}>
      <Typography variant="h2">{t("ONBOARDING_URL")}</Typography>
      <Typography variant="action" color="textSecondary">{t("ONBOARDING_PRONOTE_LOCATION_HELP")}</Typography>
      <Divider height={6} ghost />
      <Search icon="link" placeholder={t("ONBOARDING_URL_PLACEHOLDER")} style={{ width: "100%" }} value={url} setValue={setUrl} onTextChange={setUrl} autoFocus={url.trim().length === 0} />

      <Divider height={3} ghost />
      <Button label={t("CONFIRM_BTN")} fullWidth height={44} onPress={() => submitURL()} disabled={!urlValid} />

      <Divider height={18} ghost />
    </Stack>
  )
});

export default function PronoteLoginURL() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const accountType = route.params?.accountType || "eleve";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={20}>
      <List
        ListHeaderComponent={<PronoteSearchHeader accountType={accountType} />}
        contentContainerStyle={{
          padding: 16,
          flexGrow: 1,
          gap: 10,
          paddingTop: headerHeight + 20,
          paddingBottom: insets.bottom + 20,
        }}
        style={{ flex: 1 }}
        animated
      >
      </List>
    </KeyboardAvoidingView>
  )
}
