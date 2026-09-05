/* eslint-disable @typescript-eslint/no-require-imports */
import { Papicons } from '@getpapillon/papicons';
import { useTheme } from "expo-router/react-navigation";
import { RelativePathString, UnknownInputParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, ViewStyle } from 'react-native';

import { Services } from '@/stores/account/types';
import { useSettingsStore } from '@/stores/settings';
import { openMockDataAccountChooser } from '@/services/mock/account';
import { t } from 'i18next';
export interface SupportedService {
  name: string;
  route?: string;
  title: string;
  type: string[];
  hasLimitedSupport?: boolean;
  image?: NodeRequire;
  onPress: () => void;
  variant?: string;
  color?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GetSupportedServices(redirect: (path: { pathname: string, options?: UnknownInputParams }) => void): SupportedService[] {
  const theme = useTheme();
  const { colors } = theme;
  const { t } = useTranslation()
  const mockDataEnabled = useSettingsStore(state => state.personalization.mockDataEnabled ?? false);

  return [
    ...(mockDataEnabled ? [{
      name: "mock-data",
      title: "Mock Data",
      type: ["school", "univ"],
      image: require("@/assets/images/icon.png"),
      onPress: openMockDataAccountChooser,
      variant: 'service' as const,
      color: 'light' as const,
    }] : []),
    {
      name: "pronote",
      route: "pronote",
      title: t("ONBOARDING_SERVICE_PRONOTE"),
      type: ["school", "univ", "parents"],
      image: require("@/assets/images/service_pronote.png"),
      onPress: () => {
        redirect({ pathname: './school/method', options: { service: Services.PRONOTE } });
      },
      variant: 'service' as const,
      color: 'light' as const,
    },
  ]
}

export interface SupportedUniversity {
  name: string;
  title: string;
  hasLimitedSupport: boolean;
  image?: NodeRequire;
  type: string;
  onPress: () => void;
}

export function GetSupportedUniversities(redirect: (path: { pathname: string, options?: UnknownInputParams }) => void): SupportedUniversity[] {
  void redirect;
  const { t } = useTranslation();
  void t;

  return [];
}

export interface LoginMethod {
  id: string,
  availableFor: Array<Services>,
  description: string,
  icon: React.ReactNode,
  onPress: () => void;
}

export function GetLoginMethods(redirect: (path: { pathname: RelativePathString }) => void): LoginMethod[] {
  const { t } = useTranslation();

  return [
    {
      id: "map",
      availableFor: [Services.PRONOTE],
      description: t("ONBOARDING_METHOD_POSITION"),
      icon: <Papicons name={"MapPin"} />,
      onPress: async () => {
        redirect({ pathname: './map' });
      }
    },
    {
      id: "search",
      availableFor: [Services.PRONOTE],
      description: t("ONBOARDING_METHOD_SEARCH"),
      icon: <Papicons name={"Search"} />,
      onPress: () => {
        redirect({ pathname: './search' })
      }
    },
    {
      id: "qrcode",
      availableFor: [Services.PRONOTE],
      description: t("ONBOARDING_METHOD_QRCODE"),
      icon: <Papicons name={"QrCode"} />,
      onPress: () => {
        redirect({ pathname: "/(onboarding)/pronote/qrcode" });
      }
    },
    {
      id: "url",
      availableFor: [Services.PRONOTE],
      description: t("ONBOARDING_METHOD_LINK"),
      icon: <Papicons name={"Link"} />,
      onPress: () => {
        redirect({ pathname: '../pronote/url' });
      }
    }
  ]
}

export interface SupportedRestaurant {
  name: string;
  title: string;
  hasLimitedSupport: boolean;
  image: any;
  type: string;
  onPress: () => void;
}

export function GetSupportedRestaurants(redirect: (path: { pathname: string }) => void): SupportedRestaurant[] {
  return [];
}
