import { useAccountStore } from "@/stores/account";
import { useSettingsStore } from "@/stores/settings";
import type { Auth } from "@/stores/account/types";
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

// ---------------------------------------------------------------------------
// Helpers MFA / 2FA + persistance partagés (credentials / qrcode / browser / 2fa).
// Parité backend/api/index.py `_classify_pronote_error` :
//   QRCodeDecryptError -> 401 "Code PIN incorrect (QR indéchiffrable)"
//   MFAError           -> 428 "Double authentification requise"
//   QR expiré/déjà utilisé -> 401 générique "QR Code expiré ou déjà utilisé"
// ---------------------------------------------------------------------------

export type PronoteChild = { id?: string; name: string; grade?: string };

/** Normalise les enfants : conserve l'id (c.id) aux côtés de name/grade. */
export function normalizeChildren(children: unknown): PronoteChild[] {
  if (!Array.isArray(children)) return [];
  return (children as any[])
    .filter(c => c && typeof c.name === "string")
    .map(c => ({
      id: typeof c.id === "string" && c.id.length > 0 ? c.id : c.name,
      name: c.name,
      ...(typeof c.grade === "string" && c.grade ? { grade: c.grade } : {}),
    }));
}

function errorText(e: unknown): string {
  return String((e as any)?.detail || (e as any)?.message || e || "");
}

/** Backend 428 / MFAError : la double authentification est requise. */
export function isMfaRequiredError(e: unknown): boolean {
  const status = (e as any)?.status;
  if (status === 428) return true;
  const low = errorText(e).toLowerCase();
  return (
    low.includes("mfaerror") ||
    low.includes("double authentification requise") ||
    low.includes("doubleauth") ||
    low.includes("pin is required") ||
    (low.includes("http 428")) ||
    (low.includes("428") && low.includes("double"))
  );
}

/** PIN incorrect : le QR est indéchiffrable (à distinguer d'un QR expiré). */
export function isQrDecryptError(e: unknown): boolean {
  const low = errorText(e).toLowerCase();
  return (
    low.includes("qrcodedecrypt") ||
    low.includes("invalid confirmation code") ||
    low.includes("indéchiffrable") ||
    low.includes("indechiffrable") ||
    low.includes("code pin incorrect (qr")
  );
}

/** QR expiré ou déjà utilisé (jeton à usage unique brûlé). */
export function isExpiredQrError(e: unknown): boolean {
  const low = errorText(e).toLowerCase();
  return (
    low.includes("expir") ||
    low.includes("déjà utilisé") ||
    low.includes("deja utilise") ||
    low.includes("already used") ||
    low.includes("datasec") ||
    (low.includes("qr code expiré"))
  );
}

export interface MfaFields {
  accountPin?: string;
  clientIdentifier?: string;
  deviceName?: string;
}

type LoginResultLike = {
  auth_token: string;
  client_identifier?: string | null;
  credentials?: Record<string, any>;
};

/**
 * Fusionne les additionals en conservant le double schéma de clés
 * (url/instanceURL, token, uuid/deviceUUID, account_type/accountType)
 * + les champs MFA (account_pin, client_identifier, device_name).
 * `client_identifier` est repris du résultat de login (source de vérité).
 */
export function buildPronoteAdditionals(
  base: Record<string, any>,
  res: LoginResultLike,
  mfa?: MfaFields,
  rawToken?: string,
  rawUuid?: string
): Record<string, any> {
  const rawCreds = (res.credentials ?? {}) as Record<string, any>;
  const clientIdentifier =
    (res as any).client_identifier ?? rawCreds.client_identifier ?? mfa?.clientIdentifier ?? base.client_identifier;
  const accountPin = mfa?.accountPin ?? base.account_pin ?? base.accountPin;
  const deviceName = mfa?.deviceName ?? base.device_name ?? base.deviceName;
  const token = rawToken ?? rawCreds.token ?? base.token;
  const accountType = base.accountType ?? base.account_type;
  return {
    ...base,
    ...(token ? { token } : {}),
    ...(rawUuid ? { uuid: rawUuid, deviceUUID: rawUuid } : {}),
    ...(accountType ? { accountType, account_type: accountType } : {}),
    ...(accountPin ? { account_pin: accountPin, accountPin } : {}),
    ...(clientIdentifier
      ? { client_identifier: clientIdentifier, clientIdentifier }
      : {}),
    ...(deviceName ? { device_name: deviceName, deviceName } : {}),
  };
}

/** Persiste account_pin/client_identifier/device_name via updateServiceAuthData. */
export function persistMfaAuthData(
  accountId: string,
  res: LoginResultLike,
  mfa?: MfaFields
): void {
  const state = useAccountStore.getState();
  const account = state.accounts.find(a => a.id === accountId);
  const service = account?.services.find(s => s.id === accountId);
  if (!account || !service) return;
  const nextAuth: Auth = {
    ...service.auth,
    accessToken: res.auth_token,
    refreshToken: res.auth_token,
    additionals: buildPronoteAdditionals(
      {
        ...((service.auth.additionals ?? {}) as Record<string, any>),
        authToken: res.auth_token,
        auth_token: res.auth_token,
      },
      res,
      mfa
    ),
  };
  state.updateServiceAuthData(accountId, nextAuth);
}
