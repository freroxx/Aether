import { useSettingsStore } from "@/stores/settings";
import uuid from "@/utils/uuid/uuid";

/**
 * UUID stable de l'appareil pour Pronote (persisté en settings).
 * La doc pronotepy l'exige invariant entre les logins : un uuid frais à
 * chaque tentative peut faire rejeter le handshake (comptes parents).
 */
export function getDeviceUuid(): string {
  const existing = useSettingsStore.getState().personalization.deviceUuid;
  if (existing && existing.length > 0) return existing;
  const fresh = uuid();
  useSettingsStore.getState().mutateProperty("personalization", { deviceUuid: fresh });
  return fresh;
}

/**
 * Initialisation du compte juste après un login onboarding.
 * - 1 nouvel essai automatique après 2 s (transitoire : réseau, cold start).
 * - Ne supprime jamais le compte : l'appelant propose Réessayer / Supprimer.
 */
export async function initAccountAfterLogin(accountId: string): Promise<void> {
  const { initializeAccountManager } = await import("@/services/shared");
  try {
    await initializeAccountManager(accountId);
  } catch (e) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await initializeAccountManager(accountId);
  }
}

/** Cause lisible (tronquée) d'un échec d'initialisation, pour le dialogue. */
export function describeInitError(e: unknown): string {
  const raw =
    (e as any)?.message ||
    (typeof e === "string" ? e : null) ||
    "Échec de synchronisation.";
  const singleLine = String(raw).replace(/\s+/g, " ").trim();
  return singleLine.length > 180
    ? singleLine.slice(0, 177) + "…"
    : singleLine;
}
