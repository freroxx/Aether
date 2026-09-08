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
  let accountType =
    ((creds.account_type ?? creds.accountType) as string | undefined) || "eleve";

  // Garde-fou : un blob base64 stocké comme `token` n'est JAMAIS un token valide.
  const looksLikeBlob = (v: unknown) =>
    typeof v === "string" && v.length > 64 && /^[A-Za-z0-9+/=_-]+$/.test(v);
  if (token && looksLikeBlob(token)) token = undefined;

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
      if (!token && typeof inner.token === "string" && !looksLikeBlob(inner.token)) {
        token = inner.token;
      }
      uuid = uuid ?? inner.uuid;
      if (inner.account_type) accountType = inner.account_type;
    }
  }

  // 3) Rotation via /auth/token avec le token BRUT.
  if (url && username && token && uuid) {
    let res;
    try {
      res = await PronoteApiClient.tokenLogin(
        String(url),
        String(username),
        String(token),
        String(uuid),
        accountType as any
      );
    } catch (e) {
      // Session morte côté Pronote -> le manager affichera l'écran "déconnecté".
      throw new Error(
        "Session Pronote expirée, reconnectez-vous. (" + String(e) + ")"
      );
    }

    const updatedAuth: Auth = {
      accessToken: res.auth_token,
      refreshToken: res.auth_token,
      additionals: {
        ...creds,
        url,
        instanceURL: url,
        username,
        token,
        authToken: res.auth_token,
        auth_token: res.auth_token,
        uuid,
        deviceUUID: uuid,
        account_type: accountType,
        accountType,
      },
    };

    useAccountStore.getState().updateServiceAuthData(accountId, updatedAuth);
    return { auth: updatedAuth, session: { authToken: res.auth_token }, refreshed: true };
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
