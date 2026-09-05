import { PronoteApiClient } from "@/services/pronote/api-client";
import { useAccountStore } from "@/stores/account";
import { Auth } from "@/stores/account/types";
import { error } from "@/utils/logger/logger";

export async function refreshPronoteAccount(
  accountId: string,
  credentials: Auth
): Promise<{ auth: Auth; session: any }> {
  const token = credentials.accessToken || (credentials.additionals?.auth_token as string);
  const creds = credentials.additionals || {};

  if (creds.url && creds.username && creds.token && creds.uuid) {
    try {
      const res = await PronoteApiClient.tokenLogin(
        String(creds.url),
        String(creds.username),
        String(creds.token),
        String(creds.uuid),
        (creds.account_type as any) || "eleve"
      );

      const updatedAuth: Auth = {
        accessToken: res.auth_token,
        refreshToken: res.auth_token,
        additionals: {
          ...creds,
          auth_token: res.auth_token,
        },
      };

      useAccountStore.getState().updateServiceAuthData(accountId, updatedAuth);
      return { auth: updatedAuth, session: { authToken: res.auth_token } };
    } catch (e) {
      error(`Failed to refresh token: ${e}`, "refreshPronoteAccount");
    }
  }

  // Fallback to existing token
  return {
    auth: credentials,
    session: { authToken: token },
  };
}