import { router } from "expo-router";

/**
 * Navigation post-auth unifiée.
 * - Cible "/(tabs)" (route canonique NativeTabs) au lieu de "/(tabs)/index"
 *   qui est ambigu sous expo-router 57 + unstable-native-tabs et tombait en +not-found.
 * - dismissAll() d'abord pour vider la stack (onboarding)/services/pronote (formSheet),
 *   puis replace. Un micro-délai évite la race où le replace est droppé.
 */
export function finishAuthNavigation(immediate = false) {
  try {
    router.dismissAll();
  } catch {
    // noop — dismiss peut échouer s'il n'y a rien à fermer
  }
  const doReplace = () => {
    try {
      router.replace("/(tabs)");
    } catch {
      try {
        router.replace("/");
      } catch {
        // dernier recours : navigate
        router.navigate("/(tabs)" as any);
      }
    }
  };
  if (immediate) {
    doReplace();
  } else {
    setTimeout(doReplace, 60);
  }
}
