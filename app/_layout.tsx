
import 'react-native-reanimated';
import "@/utils/i18n";

import { Buffer } from 'buffer';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';

import { AppProviders } from '@/components/AppProviders';
import { RootNavigator } from '@/components/RootNavigator';
import { useAppInitialization } from '@/hooks/useAppInitialization';
import { useNetworkStore } from '@/stores/logs';
import uuid from '@/utils/uuid/uuid';
import { LogBox } from 'react-native';

// Polyfill Buffer
global.Buffer = Buffer;

LogBox.ignoreLogs([
  // TODO: fix require cycles instead of hiding them.
  "Require cycle:",
  "i18next is made possible by our own product, Locize",
  'Route "./',
  "Linking found multiple possible URI schemes in your Expo config.",
]);

export default function RootLayout() {
  const { isAppReady, fontsLoaded } = useAppInitialization();

  useEffect(() => { if (isAppReady) { SplashScreen.hideAsync().catch(() => { }); } }, [isAppReady]);

  useEffect(() => {
    if (!__DEV__) { return; }
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const id = uuid();
      let request: Request | null = null;
      if (args[0] instanceof Request && args[1] === undefined) {
        request = args[0];
      } else {
        request = new Request(...args);
      }

      try {
        useNetworkStore.getState().addRequest(request, id);
      } catch { }

      const response = await originalFetch(...args);

      try {
        useNetworkStore.getState().addResponse(response.clone(), id);
      } catch { }

      return response;
    }

    return () => {
      window.fetch = originalFetch;
    }
  }, [])

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
