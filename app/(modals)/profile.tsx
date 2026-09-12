import { Papicons } from "@getpapillon/papicons";
import { MenuView, NativeActionEvent } from "@react-native-menu/menu";
import { useHeaderHeight, useTheme } from "expo-router/react-navigation";
import * as ImagePicker from "expo-image-picker"
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OnboardingInput from "@/components/onboarding/OnboardingInput";
import { getManager } from "@/services/shared";
import type { StudentProfile } from "@/services/shared/profile";
import { useAccountStore } from "@/stores/account";
import { useAlert } from "@/ui/components/AlertProvider";
import Avatar from "@/ui/components/Avatar";
import Button from "@/ui/components/Button";
import Icon from "@/ui/components/Icon";
import { NativeHeaderPressable, NativeHeaderSide } from "@/ui/components/NativeHeader";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import { getInitials } from "@/utils/chats/initials";
import { formatSchoolName } from "@/utils/format/formatSchoolName";
import ActionMenu from "@/ui/components/ActionMenu";

export default function CustomProfileScreen() {
  const { t } = useTranslation();
  const store = useAccountStore.getState();
  const accounts = useAccountStore((state) => state.accounts);
  const lastUsedAccount = useAccountStore((state) => state.lastUsedAccount);

  const account = accounts.find((a) => a.id === lastUsedAccount);

  const [firstName, setFirstName] = useState<string>(account?.firstName ?? "");
  const [lastName, setLastName] = useState<string>(account?.lastName ?? "");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(account?.customisation?.profilePicture ? `data:image/png;base64,${account.customisation.profilePicture}` : null);
  const [pronoteProfile, setPronoteProfile] = useState<StudentProfile | null>(null);
  const [pronoteLoading, setPronoteLoading] = useState(false);
  const [fetchingPicture, setFetchingPicture] = useState(false);

  useEffect(() => {
    if (account) {
      setFirstName(account.firstName);
      setLastName(account.lastName);
      setProfilePictureUrl(account.customisation?.profilePicture ? `data:image/png;base64,${account.customisation.profilePicture}` : null);
    }
  }, [account]);

  const insets = useSafeAreaInsets()

  const updateProfilePictureFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true
    });

    if (!result.canceled) {
      const b64 = result.assets[0].base64 ?? "";
      store.setAccountProfilePicture(lastUsedAccount, b64);
    }
  }

  const alert = useAlert();
  const updateProfilePictureFromService = async () => {
    if (fetchingPicture) return;
    setFetchingPicture(true);
    try {
      const manager = getManager();
      if (!manager) {
        alert.showAlert({
          title: t("Profile_Picture_Service_Unavailable_Title", "Service indisponible"),
          message: t("Profile_Picture_Service_Unavailable_Description", "Reconnecte-toi pour récupérer ta photo Pronote."),
          description: t("Profile_Picture_Service_Unavailable_Description", "Reconnecte-toi pour récupérer ta photo Pronote."),
          icon: "Info",
        });
        return;
      }
      await manager.getProfile().catch(() => null);
      const res = await manager.getProfilePicture();
      const picture = res?.picture ?? null;
      if (picture) {
        store.setAccountProfilePicture(lastUsedAccount, picture);
      } else {
        alert.showAlert({
          title: t("Profile_Picture_Empty_Title", "Aucune photo"),
          message: t("Profile_Picture_Empty_Description", "Pronote ne renvoie aucune photo pour ce compte."),
          description: t("Profile_Picture_Empty_Description", "Pronote ne renvoie aucune photo pour ce compte."),
          icon: "Info",
        });
      }
    } catch (e) {
      alert.showAlert({
        title: t("Profile_Picture_Error_Title", "Récupération impossible"),
        message: String((e as Error)?.message ?? e).slice(0, 160) || t("Profile_Picture_Error_Description", "La photo Pronote n'a pas pu être récupérée."),
        description: String((e as Error)?.message ?? e).slice(0, 160) || t("Profile_Picture_Error_Description", "La photo Pronote n'a pas pu être récupérée."),
        icon: "Info",
      });
    } finally {
      setFetchingPicture(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setPronoteLoading(true);
        const manager = getManager();
        if (!manager) return;
        const raw = await manager.getProfile().catch(() => null);
        const profile = Array.isArray(raw)
          ? ((raw as unknown[]).find(v => v != null) as StudentProfile | undefined) ?? null
          : raw;
        if (mounted && profile) setPronoteProfile(profile);
      } catch {
        // best-effort : on masque la section en cas d'échec
      } finally {
        if (mounted) setPronoteLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const { colors } = useTheme();
  const height = useHeaderHeight();

  const className = account?.className?.trim() ?? "";
  const schoolName = account?.schoolName?.trim() ?? "";
  const showSchoolInfo = className.length > 0 || schoolName.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={"position"}
      keyboardVerticalOffset={-insets.top * 3.2}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ height: "100%" }}
      >
        <View style={{ paddingHorizontal: 50, alignItems: "center", gap: 15, paddingTop: 20 }}>
          <Avatar
            size={117}
            initials={getInitials(`${firstName} ${lastName}`)}
            imageUrl={profilePictureUrl || undefined}
          />

          <ActionMenu
            actions={[
              {
                id: 'photo_library',
                title: t("Button_Change_ProfilePicture_FromLibrary"),
                papicon: 'gallery',
                image: Platform.select({
                  ios: 'photo',
                  android: 'ic_menu_gallery',
                }),
                imageColor: colors.text
              },
              {
                id: 'from_service',
                title: t("Button_Change_ProfilePicture_FromService"),
                papicon: 'crown',
                image: Platform.select({
                  ios: 'square.and.arrow.down',
                  android: 'ic_menu_save',
                }),
                imageColor: colors.text
              },
              {
                id: 'remove_photo',
                title: t("Button_Change_ProfilePicture_Remove"),
                attributes: { destructive: true },
                papicon: 'trash',
                image: Platform.select({
                  ios: 'trash',
                  android: 'ic_menu_delete',
                }),
                imageColor: "#FF0000"
              }
            ]}
            onPressAction={(e: NativeActionEvent) => {
              switch (e.nativeEvent.event) {
                case 'photo_library':
                  updateProfilePictureFromLibrary();
                  break;
                case 'from_service':
                  updateProfilePictureFromService();
                  break;
                case 'remove_photo':
                  store.setAccountProfilePicture(lastUsedAccount, "");
                  break;
              }
            }}
          >
            <Button
              inline
              size="small"
              icon={<Papicons name="Camera" />}
              title={t("Button_Change_ProfilePicture")}
            />
          </ActionMenu>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 30, gap: 15 }}>
          <View style={{ gap: 10 }}>
            <Typography color="secondary">Prénom</Typography>
            <OnboardingInput
              placeholder={"Prénom"}
              text={firstName}
              setText={setFirstName}
              icon={"Font"}
              inputProps={{}}
            />
            <Typography color="secondary">Nom</Typography>
            <OnboardingInput
              placeholder={"Nom"}
              text={lastName}
              setText={setLastName}
              icon={"Bold"}
              inputProps={{}}
            />
          </View>
          {showSchoolInfo && (
            <View style={{ gap: 10 }}>
              {className.length > 0 && (
                <>
                  <Typography color="secondary">{t("Profile_Class_Label")}</Typography>
                  <Stack
                    direction="horizontal"
                    vAlign="center"
                    hAlign="center"
                    gap={10}
                    style={{
                      padding: 20,
                      backgroundColor: String(colors.text) + "08",
                      borderRadius: 300,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Icon papicon size={24} fill={String(colors.text) + "AF"}>
                      <Papicons name="User" />
                    </Icon>
                    <Typography variant="body1" style={{ flex: 1 }}>
                      {className}
                    </Typography>
                  </Stack>
                </>
              )}
              {schoolName.length > 0 && (
                <>
                  <Typography color="secondary">{t("Profile_School_Label")}</Typography>
                  <Stack
                    direction="horizontal"
                    vAlign="center"
                    hAlign="center"
                    gap={10}
                    style={{
                      padding: 20,
                      backgroundColor: String(colors.text) + "08",
                      borderRadius: 300,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Icon papicon size={24} fill={String(colors.text) + "AF"}>
                      <Papicons name="MapPin" />
                    </Icon>
                    <Typography variant="body1" style={{ flex: 1 }} numberOfLines={2}>
                      {formatSchoolName(schoolName)}
                    </Typography>
                  </Stack>
                </>
              )}
            </View>
          )}
          {pronoteLoading ? (
            <View style={{ paddingVertical: 8, alignItems: "center" }}>
              <ActivityIndicator size="small" color={String(colors.text) + "88"} />
            </View>
          ) : pronoteProfile &&
            ((pronoteProfile.email?.trim()?.length ?? 0) > 0 ||
              (pronoteProfile.phone?.trim()?.length ?? 0) > 0 ||
              (pronoteProfile.ineNumber?.trim()?.length ?? 0) > 0 ||
              (pronoteProfile.delegue?.length ?? 0) > 0 ||
              (pronoteProfile.address?.length ?? 0) > 0) ? (
            <View style={{ gap: 10 }}>
              <Typography color="secondary">{t("Profile_PronoteInfos", "Infos Pronote")}</Typography>
              {(pronoteProfile.email?.trim()?.length ?? 0) > 0 && (
                <>
                  <Typography color="secondary">{t("Profile_Pronote_Email", "E-mail")}</Typography>
                  <Stack
                    direction="horizontal"
                    vAlign="center"
                    hAlign="center"
                    gap={10}
                    style={{
                      padding: 20,
                      backgroundColor: String(colors.text) + "08",
                      borderRadius: 300,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Icon papicon size={24} fill={String(colors.text) + "AF"}>
                      <Papicons name="Mail" />
                    </Icon>
                    <Typography variant="body1" style={{ flex: 1 }} numberOfLines={2}>
                      {pronoteProfile.email}
                    </Typography>
                  </Stack>
                </>
              )}
              {(pronoteProfile.phone?.trim()?.length ?? 0) > 0 && (
                <>
                  <Typography color="secondary">{t("Profile_Pronote_Phone", "Téléphone")}</Typography>
                  <Stack
                    direction="horizontal"
                    vAlign="center"
                    hAlign="center"
                    gap={10}
                    style={{
                      padding: 20,
                      backgroundColor: String(colors.text) + "08",
                      borderRadius: 300,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Icon papicon size={24} fill={String(colors.text) + "AF"}>
                      <Papicons name="Phone" />
                    </Icon>
                    <Typography variant="body1" style={{ flex: 1 }}>
                      {pronoteProfile.phone}
                    </Typography>
                  </Stack>
                </>
              )}
              {(pronoteProfile.ineNumber?.trim()?.length ?? 0) > 0 && (
                <>
                  <Typography color="secondary">{t("Profile_Pronote_INE", "N° INE")}</Typography>
                  <Stack
                    direction="horizontal"
                    vAlign="center"
                    hAlign="center"
                    gap={10}
                    style={{
                      padding: 20,
                      backgroundColor: String(colors.text) + "08",
                      borderRadius: 300,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Icon papicon size={24} fill={String(colors.text) + "AF"}>
                      <Papicons name="Info" />
                    </Icon>
                    <Typography variant="body1" style={{ flex: 1 }}>
                      {pronoteProfile.ineNumber}
                    </Typography>
                  </Stack>
                </>
              )}
              {(pronoteProfile.delegue?.length ?? 0) > 0 && (
                <>
                  <Typography color="secondary">{t("Profile_Pronote_Delegue", "Délégué")}</Typography>
                  <Stack
                    direction="horizontal"
                    vAlign="center"
                    hAlign="center"
                    gap={10}
                    style={{
                      padding: 20,
                      backgroundColor: String(colors.text) + "08",
                      borderRadius: 300,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Icon papicon size={24} fill={String(colors.text) + "AF"}>
                      <Papicons name="User" />
                    </Icon>
                    <Typography variant="body1" style={{ flex: 1 }} numberOfLines={2}>
                      {pronoteProfile.delegue.join(", ")}
                    </Typography>
                  </Stack>
                </>
              )}
              {(pronoteProfile.address?.length ?? 0) > 0 && (
                <>
                  <Typography color="secondary">{t("Profile_Pronote_Address", "Adresse")}</Typography>
                  <Stack
                    direction="horizontal"
                    vAlign="center"
                    hAlign="center"
                    gap={10}
                    style={{
                      padding: 20,
                      backgroundColor: String(colors.text) + "08",
                      borderRadius: 300,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Icon papicon size={24} fill={String(colors.text) + "AF"}>
                      <Papicons name="MapPin" />
                    </Icon>
                    <Typography variant="body1" style={{ flex: 1 }} numberOfLines={3}>
                      {pronoteProfile.address.join("\n")}
                    </Typography>
                  </Stack>
                </>
              )}
            </View>
          ) : null}
        </View>
        <NativeHeaderSide side="Left" key={`${firstName}-${lastName}`}>
          <NativeHeaderPressable
            onPressIn={() => {
              useAccountStore.getState().setAccountName(lastUsedAccount, firstName, lastName);
              router.back();
            }}
          >
            <Icon papicon size={26}>
              <Papicons name="ArrowLeft" />
            </Icon>
          </NativeHeaderPressable>

        </NativeHeaderSide>
      </ScrollView>
    </ KeyboardAvoidingView >
  );
}