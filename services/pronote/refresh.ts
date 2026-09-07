import { PronoteApiClient } from "@/services/pronote/api-client";
import { useAccountStore } from "@/stores/account";
import { Auth } from "@/stores/account/types";

export async function refreshPronoteAccount(
  accountId: string,
  credentials: Auth
): Promise<{ auth: Auth; session: any; refreshed: boolean }> {
  const creds = credentials.additionals || {};

  // Les écrans de login stockent {instanceURL, username, deviceUUID, authToken, accountType} ;
  // on accepte aussi l'ancien schéma {url, username, token, uuid, account_type, auth_token}.
  const url = (creds.url ?? creds.instanceURL) as string | undefined;
  const username = creds.username as string | undefined;
  const token = (creds.token ?? creds.authToken) as string | undefined;
  const uuid = (creds.uuid ?? creds.deviceUUID) as string | undefined;
  const accountType = ((creds.account_type ?? creds.accountType) as string | undefined) || "eleve";

  if (url && username && token && uuid) {
    const res = await PronoteApiClient.tokenLogin(
      String(url),
      String(username),
      String(token),
      String(uuid),
      accountType as any
    );

    const updatedAuth: Auth = {
      accessToken: res.auth_token,
      refreshToken: res.auth_token,
      additionals: {
        ...creds,
        url,
        instanceURL: url,
        token: res.auth_token,
        authToken: res.auth_token,
        auth_token: res.auth_token,
        uuid,
        deviceUUID: uuid,
        account_type: accountType,
        accountType,
        username,
      },
    };

    useAccountStore.getState().updateServiceAuthData(accountId, updatedAuth);
    return { auth: updatedAuth, session: { authToken: res.auth_token }, refreshed: true };
  }

  // Pas de quoi rafraîchir : on garde le token existant sans prolonger sa validité.
  // Une erreur explicite permet au manager de lever AuthenticationError (écran reconnect).
  const existing = credentials.accessToken || (creds.auth_token as string) || (creds.authToken as string);
  if (!existing) {
    throw new Error("Aucun identifiant Pronote pour rafraîchir la session");
  }
  return {
    auth: credentials,
    session: { authToken: existing },
    refreshed: false,
  };
}