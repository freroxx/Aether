import { PronoteApiClient } from "@/services/pronote/api-client";
import { useAccountStore } from "@/stores/account";
import { Auth } from "@/stores/account/types";

/**
 * Décode un auth_token (base64 d'un JSON {url, username, token|password, uuid, ...}).
 * Sert à migrer les comptes créés avant le stockage des identifiants bruts.
 * Retourne null si indécodable.
 */
function decodeStoredBlob(blob: unknown): Record<string, any> | null {
  if (typeof blob !== "string" || blob.length === 0) return null;
  try {
    const bin = atob(blob.replace(/-/g, "+").replace(/_/g, "/"));
    let json: string;
    try {
      // JSON potentiellement accentué (noms d'établissements) : décodage UTF-8.
      json = decodeURIComponent(
        bin
          .split("")
          .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } catch {
      json = bin;
    }
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function refreshPronoteAccount(
  accountId: string,
  credentials: Auth
): Promise<{ auth: Auth; session: any; refreshed: boolean }> {
  const creds = credentials.additionals || {};

  // 1) Champs bruts (nouveaux comptes) : les 2 schémas de clés.
  let url = (creds.url ?? creds.instanceURL) as string | undefined;
  let username = creds.username as string | undefined;
  let token = (creds.token ?? undefined) as string | undefined;
  let uuid = (creds.uuid ?? creds.deviceUUID) as string | undefined;
  const password = creds.password as string | undefined;
  const accountPin = (creds.account_pin ?? creds.accountPin) as string | undefined;
  const clientIdentifier = (creds.client_identifier ?? creds.clientIdentifier) as string | undefined;
  const deviceName = (creds.device_name ?? creds.deviceName) as string | undefined;
  let accountType =
    ((creds.account_type ?? creds.accountType) as string | undefined) || "eleve";

  // Garde-fou : le blob base64 stocké par l'app ({url, username, token|password,
  // uuid, ...} encodé) n'est JAMAIS un token valide. Test précis : il se décode
  // en JSON contenant nos clés. Un token brut (hex/base64 long) ne parse jamais
  // en JSON : on ne doit surtout pas le rejeter (sinon login/refresh morts).
  const isStoredBlob = (v: unknown): boolean => {
    if (typeof v !== "string" || v.length <= 64) return false;
    if (!/^[A-Za-z0-9+/=_-]+$/.test(v)) return false;
    const inner = decodeStoredBlob(v);
    return (
      !!inner &&
      typeof inner === "object" &&
      ("url" in inner || "username" in inner || "instanceURL" in inner)
    );
  };
  if (token && isStoredBlob(token)) token = undefined;

  // 2) Migration vieux comptes : décoder le blob stocké (accessToken ou authToken).
  if ((!token || !uuid || !url || !username) && !password) {
    const blob =
      credentials.accessToken ||
      (creds.auth_token as string) ||
      (creds.authToken as string);
    const inner = decodeStoredBlob(blob);
    if (inner) {
      url = url ?? inner.url;
      username = username ?? inner.username;
      if (!token && typeof inner.token === "string" && !isStoredBlob(inner.token)) {
        token = inner.token;
      }
      uuid = uuid ?? inner.uuid;
      if (inner.account_type) accountType = inner.account_type;
    }
  }

  // 3) Rotation via /auth/token avec le token BRUT.
  if (url && username && token && uuid) {
    const mfa = accountPin || clientIdentifier || deviceName
      ? { accountPin, clientIdentifier, deviceName }
      : undefined;
    let res;
    let rotated = false;
    try {
      res = await PronoteApiClient.tokenLogin(
        String(url),
        String(username),
        String(token),
        String(uuid),
        accountType as any,
        mfa
      );
      rotated = true;
    } catch (e) {
      // Le token stocké en clair peut être périmé (rotation précédente dont
      // seul le blob a gardé le token frais) : on réessaie une fois avec le
      // token du blob avant de déclarer la session morte.
      const blobInner = decodeStoredBlob(
        credentials.accessToken ||
          (creds.auth_token as string) ||
          (creds.authToken as string)
      );
      const blobToken =
        blobInner && typeof blobInner.token === "string" ? blobInner.token : undefined;
      if (blobToken && blobToken !== token && !isStoredBlob(blobToken)) {
        try {
          res = await PronoteApiClient.tokenLogin(
            String(url),
            String(username),
            String(blobToken),
            String(uuid),
            accountType as any,
            mfa
          );
          token = blobToken;
          rotated = true;
        } catch {
          // On retombe sur les voies ci-dessous (password, puis erreur).
        }
      }
      if (!rotated && !(password && url && username)) {
        // Session morte côté Pronote -> le manager affichera l'écran "déconnecté".
        throw new Error(
          "Session Pronote expirée, reconnectez-vous. (" + String(e) + ")"
        );
      }
      // Token rejeté mais on a un mot de passe (cas ENT / navigateur) : on
      // bascule dessus, les routes data rejouent username+password via le
      // backend. Sans mot de passe, la session est vraiment morte (jeté ci-dessus).
    }

    if (rotated) {
      // Le backend fait tourner le token à chaque login : on stocke le NOUVEAU
      // token (décodé du blob retourné) en clair, sinon la prochaine relance
      // rejoue l'ancien token mort ("déconnecté" au redémarrage).
      const freshInner = decodeStoredBlob((res as any).auth_token);
      const freshToken =
        freshInner && typeof freshInner.token === "string" && !isStoredBlob(freshInner.token)
          ? freshInner.token
          : token;
      const updatedAuth: Auth = {
        accessToken: (res as any).auth_token,
        refreshToken: (res as any).auth_token,
        additionals: {
          ...creds,
          url,
          instanceURL: url,
          username,
          token: freshToken,
          authToken: (res as any).auth_token,
          auth_token: (res as any).auth_token,
          uuid,
          deviceUUID: uuid,
          account_type: accountType,
          accountType,
          ...(accountPin ? { account_pin: accountPin } : {}),
          ...((res as any).client_identifier ? { client_identifier: (res as any).client_identifier } : {}),
          ...(deviceName ? { device_name: deviceName } : {}),
        },
      };

      useAccountStore.getState().updateServiceAuthData(accountId, updatedAuth);
      return { auth: updatedAuth, session: { authToken: (res as any).auth_token }, refreshed: true };
    }
  }

  // 4) Login direct (username+password) : rien à faire pivoter, les routes data
  // rejouent le password via le backend. On garde le blob tel quel.
  if (url && username && password) {
    return {
      auth: credentials,
      session: {
        authToken:
          credentials.accessToken ||
          (creds.auth_token as string) ||
          (creds.authToken as string),
      },
      refreshed: false,
    };
  }

  // 5) Vraiment rien d'exploitable : compte à reconnecter.
  throw new Error("Session Pronote expirée, reconnectez-vous.");
}
