import * as Haptics from "expo-haptics";

function silent(_error: unknown) {
  if (__DEV__) {
    // Silent in dev — no warning, no throw.
  }
}

export async function light(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {
    silent(e);
  }
}

export async function medium(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (e) {
    silent(e);
  }
}

export async function success(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (e) {
    silent(e);
  }
}

export async function error(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (e) {
    silent(e);
  }
}

export async function selection(): Promise<void> {
  try {
    await Haptics.selectionAsync();
  } catch (e) {
    silent(e);
  }
}

export type HapticResult = "success" | "error" | "light" | "medium" | "selection" | "warning";

export function hapticFor(result: HapticResult): Promise<void> {
  switch (result) {
    case "success":
      return success();
    case "error":
      return error();
    case "medium":
      return medium();
    case "selection":
      return selection();
    case "warning":
      try {
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(silent);
      } catch (e) {
        silent(e);
        return Promise.resolve();
      }
    case "light":
    default:
      return light();
  }
}
