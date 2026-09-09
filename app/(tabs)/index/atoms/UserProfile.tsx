import { Papicons } from '@getpapillon/papicons';
import { MenuView } from '@react-native-menu/menu';
import { useTheme } from "expo-router/react-navigation";
import { LiquidGlassView } from '@sbaiahmed1/react-native-blur';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, Platform, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';

import { initializeAccountManager } from '@/services/shared';
import { useAccountStore } from '@/stores/account';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import Avatar from '@/ui/components/Avatar';
import Stack from '@/ui/components/Stack';
import Typography from '@/ui/components/Typography';
import { runsIOS26 } from '@/ui/utils/IsLiquidGlass';

import { useUserProfileData } from '../hooks/useUserProfileData';
import { t } from 'i18next';
import { formatSchoolName } from '@/utils/format/formatSchoolName';
import ActionMenu from '@/ui/components/ActionMenu';

const UserProfile = ({ subtitle, onPress }: { subtitle?: string, onPress?: () => void }) => {
  const router = useRouter();
  const { firstName, lastName, initials, profilePicture, level, establishment } = useUserProfileData() ?? {};
  const accounts = useAccountStore((state) => state.accounts);
  const lastUsedAccount = useAccountStore((state) => state.lastUsedAccount);
  const theme = useTheme();

  const currentAccount = accounts.find((a) => a.id === lastUsedAccount);
  const isParent = currentAccount?.accountType === "parent";
  const currentChildName = currentAccount?.selectedChild || currentAccount?.children?.[0]?.name;

  const ChildrenMenuItems = (isParent && currentAccount?.children && currentAccount.children.length > 0)
    ? currentAccount.children.map((c) => ({
        id: `child:${c.name}`,
        title: `Enfant: ${c.name}`,
        subtitle: c.grade || "Élève",
        state: (c.name === currentChildName ? 'on' : 'off') as 'on' | 'off',
      }))
    : [];

  const effectiveSubtitle = subtitle || (isParent && currentChildName ? `Enfant : ${currentChildName}` : undefined);

  const AccountsMenuItems = (accounts && accounts.length > 0) && accounts.map((account) => ({
    id: account.id,
    title: account.firstName + ' ' + account.lastName,
    subtitle: formatSchoolName(account.schoolName ?? ""),
    state: (account.id === lastUsedAccount ? 'on' : 'off') as 'on' | 'off',
  })) || [];

  return (
    <Stack inline flex>
      <Stack
        direction="horizontal"
        hAlign="center"
        gap={10}
      >
            <UserProfileItemContainer
              glassType="clear"
              isInteractive={true}
              glassTintColor="transparent"
            glassOpacity={0}
            style={{
              borderRadius: 300,
              zIndex: 999999,
            }}
          >
        <Link asChild href="/(modals)/profile">
        <Link.AppleZoom>
          <Pressable>
            <Avatar
              size={40}
              initials={initials}
              imageUrl={profilePicture}
            />
        </Pressable>
        </Link.AppleZoom>
        </Link>
          </UserProfileItemContainer>

        <UserProfileItemContainer>
          <ActionMenu
            onPressAction={async ({ nativeEvent }) => {
              if (nativeEvent.event === "edit") {
                router.push('/(modals)/profile');
                return;
              }

              if (nativeEvent.event === "add") {
                router.push("/(onboarding)/ageSelection?action=addService");
                return;
              }

              if (nativeEvent.event.startsWith("child:")) {
                const childName = nativeEvent.event.replace("child:", "");
                const store = useAccountStore.getState();
                if (currentAccount && childName !== currentAccount.selectedChild) {
                  store.setSelectedChild(currentAccount.id, childName);
                  // Vide l'UI tout de suite (skeleton), le réseau suit en fond.
                  useSyncStore.getState().bumpAccountEpoch();
                  await initializeAccountManager();
                }
                return;
              }

              const store = useAccountStore.getState();
              const settingsStore = useSettingsStore.getState();
              const currentAccountId = store.lastUsedAccount;
              const currentDisabledTabs = settingsStore.personalization.disabledTabs ?? [];
              const nextDisabledTabsByAccount = {
                ...(settingsStore.personalization.disabledTabsByAccount ?? {}),
                ...(currentAccountId ? { [currentAccountId]: currentDisabledTabs } : {}),
              };
              const disabledTabsForAccount = nextDisabledTabsByAccount[nativeEvent.event] ?? [];
              settingsStore.mutateProperty("personalization", {
                disabledTabsByAccount: nextDisabledTabsByAccount,
                disabledTabs: disabledTabsForAccount,
              });
              if (nativeEvent.event === currentAccountId) return;
              store.setLastUsedAccount(nativeEvent.event);
              // Vide l'UI tout de suite (skeleton), le réseau suit en fond.
              useSyncStore.getState().bumpAccountEpoch();
              await initializeAccountManager(nativeEvent.event);
            }}
            actions={[
              ...(ChildrenMenuItems.length > 0 ? [
                ...(Platform.OS === "ios" ? [{
                  id: 'children_group',
                  title: 'Mes enfants',
                  displayInline: true,
                  subactions: ChildrenMenuItems,
                }] : ChildrenMenuItems)
              ] : []),
              ...(Platform.OS === "ios" ? [{
                id: 'workspaces',
                title: '',
                displayInline: true,
                subactions: AccountsMenuItems,
              }] : AccountsMenuItems),
              {
                id: 'edit',
                title: t('Home_Edit_Profile'),
                image: 'person.crop.circle',
                papicon: 'user',
              },
              {
                id: 'add',
                title: t('Home_Add_Profile'),
                image: 'plus',
                papicon: 'add',
              },
            ]}
          >
            <Stack direction="vertical" vAlign="center" gap={0} style={{ height: 42, paddingHorizontal: 12 }}>
              <Stack direction="horizontal" hAlign="center" gap={6}>
                <Typography nowrap color='white' variant='navigation' weight='bold' style={{ maxWidth: Dimensions.get('window').width - 230 }}>
                  {firstName && lastName ? `${firstName} ${lastName}` : "Mon compte"}
                </Typography>
                <Papicons name="chevrondown" size={20} color="white" opacity={0.5} style={{ marginRight: 0 }} />
              </Stack>
              {effectiveSubtitle &&
                <Typography nowrap color='white' variant='body1' style={{ opacity: 0.7 }}>
                  {effectiveSubtitle}
                </Typography>
              }
            </Stack>
          </ActionMenu>
        </UserProfileItemContainer>
      </Stack>
    </Stack>
  );
};

const UserProfileItemContainer = ({ children }: { children: React.ReactNode }) => {
  if (runsIOS26) {
    return (
      <LiquidGlassView
        glassType="clear"
        isInteractive={true}
        glassTintColor="transparent"
        glassOpacity={0}
        style={{
          borderRadius: 300,
          zIndex: 999999,
        }}
      >
        {children}
      </LiquidGlassView>
    );
  }


  return (
    <Stack style={{ marginRight: -8 }}>
      {children}
    </Stack>
  )

}

const styles = StyleSheet.create({
  container: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  }
});

export default UserProfile;
