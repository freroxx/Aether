import { Directory, File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Platform, Share } from "react-native";

import { PronoteApiClient } from "@/services/pronote/api-client";
import { Attachment, AttachmentType } from "@/services/shared/attachment";
import { Services } from "@/stores/account/types";
import { useAccountStore } from "@/stores/account";

export interface ServiceFileAuth {
  authToken: string;
  childName?: string;
}

type AlertLike = {
  showAlert: (alert: {
    title: string;
    description?: string;
    message?: string;
    icon?: string;
    color?: string;
    technical?: string;
    delay?: number;
  }) => void;
};

export function isLinkAttachment(attachment: Attachment): boolean {
  const rawType = (attachment as { type?: unknown }).type;
  return (
    rawType === AttachmentType.LINK ||
    rawType === 0 ||
    rawType === "link" ||
    rawType === "LINK"
  );
}

export interface ResolvedFileAuth extends ServiceFileAuth {
  accountId?: string;
}

/** Retrouve le token Pronote (X-Pronote-Auth) + enfant sélectionné depuis le store.
 * createdByAccount peut être un accountId OU un service.id (les deux schémas existent). */
export function resolvePronoteFileAuth(createdByAccount?: string): ResolvedFileAuth | null {
  const state = useAccountStore.getState();
  let account = createdByAccount
    ? state.accounts.find(
        a =>
          a.id === createdByAccount ||
          a.services.some(s => s.id === createdByAccount)
      )
    : undefined;
  let service = account?.services.find(
    s => s.id === createdByAccount || s.serviceId === Services.PRONOTE
  );

  if (!service || !account) {
    const lastId = state.lastUsedAccount;
    account = state.accounts.find(a => a.id === lastId) ?? state.accounts[0];
    service =
      account?.services.find(s => s.serviceId === Services.PRONOTE) ??
      account?.services[0];
  }
  if (!service || !account) return null;

  const auth = service.auth ?? {};
  const token =
    auth.accessToken ||
    (auth.additionals?.auth_token as string | undefined) ||
    (auth.additionals?.authToken as string | undefined) ||
    "";
  if (!token) return null;

  return { authToken: token, childName: account.selectedChild, accountId: account.id };
}

function sanitizeFileName(name: string): string {
  let cleaned = (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|%#&+={}[\]`~^]/g, "_")
    .replace(/[^\x20-\x7E_.\-]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 80) {
    const dot = cleaned.lastIndexOf(".");
    const ext = dot > 0 ? cleaned.slice(dot) : "";
    cleaned = cleaned.slice(0, 80 - ext.length).trim() + ext;
  }
  return cleaned.length > 0 ? cleaned : "fichier";
}

async function purgeOldAttachments(): Promise<void> {
  try {
    const dir = new Directory(Paths.cache, "attachments");
    if (!dir.exists) return;
    const items = await dir.list();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const item of items as any[]) {
      try {
        const uri: string = (item as any)?.uri ?? "";
        const mtime: number = (item as any)?.modificationTime ?? 0;
        if (mtime && mtime < cutoff && uri) {
          await new File(uri).delete();
        }
      } catch {
        // best-effort
      }
    }
  } catch {
    // best-effort
  }
}

function showFileError(
  alert: AlertLike | undefined,
  stage: "download" | "open",
  description: string,
  technical?: string
): void {
  if (!alert) return;
  alert.showAlert({
    title: stage === "download" ? "Téléchargement impossible" : "Ouverture impossible",
    description,
    icon: "AlertTriangle",
    color: "#D60046",
    technical,
    delay: 4000,
  });
}

/**
 * Télécharge une pièce jointe FILE via le backend /files/download
 * puis l'écrit dans FileSystem.cacheDirectory (base64) et renvoie l'URI locale.
 */
export async function downloadAttachment(
  attachment: Attachment,
  serviceAuth?: ServiceFileAuth | null,
  dueDate?: Date | string
): Promise<{ uri: string; filename: string; mime: string }> {
  const url = (attachment.url ?? "").trim();
  const name = (attachment.name ?? "").trim() || "fichier";
  if (!url) {
    throw new Error("Adresse du fichier manquante.");
  }
  if (!serviceAuth?.authToken) {
    throw new Error("Session Pronote expirée, reconnectez-vous.");
  }

  // Indice de date : le backend scanne ±7j d'abord au lieu de 150j systématiques.
  let dueDateStr: string | undefined;
  try {
    const d = dueDate instanceof Date ? dueDate : dueDate ? new Date(dueDate) : undefined;
    if (d && !isNaN(d.getTime())) dueDateStr = d.toISOString().split("T")[0];
  } catch {
    dueDateStr = undefined;
  }

  const data = await PronoteApiClient.downloadFile(
    serviceAuth.authToken,
    url,
    name,
    serviceAuth.childName,
    dueDateStr
  );
  if (!data?.base64) {
    throw new Error("Fichier vide reçu du serveur.");
  }

  const filename = sanitizeFileName(data.filename || name);
  const mime = data.mime || "application/octet-stream";

  await purgeOldAttachments();
  const dir = new Directory(Paths.cache, "attachments");
  try {
    if (!dir.exists) await dir.create();
  } catch {
    // le dossier existe déjà (race) — on continue
  }
  const file = new File(dir, `${Date.now()}_${filename}`);
  await file.create({ overwrite: true });
  await file.write(data.base64, { encoding: "base64" });

  return { uri: file.uri, filename, mime };
}

/**
 * Ouvre une pièce jointe :
 * - LINK -> WebBrowser.openBrowserAsync
 * - FILE -> téléchargement via backend puis ouverture directe :
 *   Android = Intent ACTION_VIEW (visionneuse par défaut, pas de share sheet),
 *   iOS = aperçu navigateur pour PDF/images, sinon partage système en repli.
 * Les erreurs sont affichées en français via `alert` (useAlert), jamais Alert.alert.
 */
export async function openAttachment(
  attachment: Attachment,
  serviceAuth?: ServiceFileAuth | null,
  alert?: AlertLike,
  dueDate?: Date | string
): Promise<void> {
  const url = (attachment.url ?? "").trim();
  const name = (attachment.name ?? "").trim() || "document";

  try {
    if (isLinkAttachment(attachment)) {
      if (!url) {
        throw new Error("Adresse du lien manquante.");
      }
      await WebBrowser.openBrowserAsync(url);
      return;
    }

    if (!url) {
      throw new Error(`Le fichier « ${name} » est indisponible (adresse manquante).`);
    }

    // Best-effort: rafraîchir la session avant de télécharger (token rotatif).
    let auth = serviceAuth;
    try {
      const resolved = serviceAuth as ResolvedFileAuth | null;
      if (resolved?.accountId) {
        const { refreshPronoteAccount } = await import("@/services/pronote/refresh");
        const state = useAccountStore.getState();
        const acc = state.accounts.find(a => a.id === resolved.accountId);
        const svc =
          acc?.services.find(s => s.serviceId === Services.PRONOTE) ?? acc?.services[0];
        if (acc && svc) {
          try {
            await refreshPronoteAccount(acc.id, svc.auth as any);
            auth = resolvePronoteFileAuth(resolved.accountId) ?? serviceAuth;
          } catch {
            // on garde le token existant, le backend dira 401 si vraiment mort
          }
        }
      }
    } catch {
      // best-effort
    }

    let downloaded: { uri: string; filename: string; mime: string };
    try {
      downloaded = await downloadAttachment(attachment, auth, dueDate);
    } catch (dlErr) {
      // Backend déployé trop vieux (route /files/download inconnue → 404
      // "Not Found" FastAPI) : repli ouverture directe de l'URL plutôt
      // qu'un toast sec. Le backend se met à jour au prochain déploiement.
      const status = (dlErr as any)?.status;
      const detail = String((dlErr as any)?.detail ?? (dlErr instanceof Error ? dlErr.message : dlErr ?? ""));
      if (status === 404 && detail.trim().toLowerCase() === "not found" && url) {
        const { error: logError } = await import("@/utils/logger/logger");
        logError(`openAttachment stale-backend fallback: opening raw URL ${url}`);
        await WebBrowser.openBrowserAsync(url);
        if (alert) {
          alert.showAlert({
            title: "Serveur à mettre à jour",
            description: "Ouverture directe : reconnecte-toi pour profiter du téléchargement intégré.",
            icon: "Info",
            color: "#007AFF",
            delay: 4000,
          });
        }
        return;
      }
      throw dlErr;
    }
    const { uri, filename, mime } = downloaded;

    const lower = filename.toLowerCase();
    const previewable =
      mime.startsWith("image/") ||
      mime === "application/pdf" ||
      lower.endsWith(".pdf") ||
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".gif") ||
      lower.endsWith(".webp");

    // Vérifie que le fichier existe et n'est pas vide avant d'ouvrir.
    try {
      const check = new File(uri);
      if (!check.exists) {
        throw new Error("Fichier local introuvable après téléchargement.");
      }
      const size = check.size ?? 0;
      if (size <= 0) {
        throw new Error("Fichier vide reçu du serveur.");
      }
      if (size > 25 * 1024 * 1024) {
        throw new Error("Fichier trop volumineux pour être ouvert depuis l'app.");
      }
    } catch (guardErr) {
      const msg = guardErr instanceof Error ? guardErr.message : String(guardErr ?? "");
      if (/vide|volumineux|introuvable/.test(msg.toLowerCase())) throw guardErr;
      // Stat impossible (FS exotique) : on tente quand même l'ouverture.
    }

    // Ouverture directe (pas de menu Partage) :
    // - Android : Intent ACTION_VIEW avec URI content:// (FileProvider) + MIME.
    //   Ouvre la visionneuse par défaut (PDF, image, etc.) au lieu du share sheet.
    // - iOS : aperçu navigateur pour PDF/images, sinon partage système.
    if (Platform.OS === "android") {
      try {
        const { getContentUriAsync } = await import("expo-file-system/legacy");
        const contentUri = await getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: mime,
        });
        return;
      } catch (viewErr) {
        const { error: logError } = await import("@/utils/logger/logger");
        logError(`openAttachment VIEW failed, fallback to share: ${filename} ${mime} :: ${String(viewErr)}`);
        const msg = String(viewErr instanceof Error ? viewErr.message : viewErr ?? "").toLowerCase();
        // Aucune appli pour ce type -> message clair plutôt que share sheet confus.
        if (msg.includes("no activity") || msg.includes("no app") || msg.includes("activitynotfound")) {
          throw new Error(`Ouverture impossible (${filename}, ${mime}). Aucune application installée pour ouvrir ce type de fichier.`);
        }
        // Sinon : repli partage (l'utilisateur peut quand même l'envoyer ailleurs).
      }
    } else if (previewable) {
      // iOS : aperçu intégré sans passer par le share sheet.
      try {
        await WebBrowser.openBrowserAsync(uri);
        return;
      } catch (openErr) {
        const { error: logError } = await import("@/utils/logger/logger");
        logError(`openAttachment browser failed: ${filename} ${mime} ${uri} :: ${String(openErr)}`);
      }
    }

    // Repli : partage système (FileProvider content://, jamais file:// en
    // ACTION_SEND sinon FileUriExposedException). Proposé seulement si
    // l'ouverture directe a échoué.
    const canShareNative = await Sharing.isAvailableAsync().catch(() => false);
    if (canShareNative) {
      await Sharing.shareAsync(uri, {
        mimeType: mime,
        dialogTitle: filename,
        UTI: mime.startsWith("image/")
          ? "public.image"
          : mime === "application/pdf"
            ? "com.adobe.pdf"
            : undefined,
      });
      return;
    }

    // Dernier recours : Share RN (peut échouer sur file:// Android 7+).
    try {
      const result = await Share.share({ url: uri, title: filename, message: filename });
      if ((result as any)?.action === Share.dismissedAction) return;
    } catch (shareErr) {
      const { error: logError } = await import("@/utils/logger/logger");
      logError(`openAttachment share failed: ${filename} ${mime} ${uri} :: ${String(shareErr)}`);
      throw new Error(`Ouverture impossible (${filename}, ${mime}). ${shareErr instanceof Error ? shareErr.message : String(shareErr ?? "")}`);
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err ?? "");
    const lowerRaw = raw.toLowerCase();
    const isOpenStage = lowerRaw.includes("ouverture impossible");
    const isAbort =
      lowerRaw.includes("abort") ||
      (err as any)?.name === "AbortError" ||
      lowerRaw.includes("network request failed") ||
      lowerRaw.includes("fetch failed");
    let description = "Téléchargement impossible. Vérifiez votre connexion puis réessayez.";
    if (isAbort) {
      description = "Serveur lent ou injoignable, réessaie dans un instant.";
    } else if (
      lowerRaw.includes("expirée") ||
      lowerRaw.includes("reconnectez") ||
      lowerRaw.includes("401") ||
      lowerRaw.includes("auth")
    ) {
      description = "Session Pronote expirée, reconnectez-vous puis réessayez.";
    } else if (lowerRaw.includes("introuvable") || lowerRaw.includes("404")) {
      description = "Fichier introuvable ou expiré. Rouvrez la liste pour rafraîchir.";
    } else if (lowerRaw.includes("volumineux") || lowerRaw.includes("413")) {
      description = "Fichier trop volumineux pour être ouvert depuis l'app.";
    } else if (lowerRaw.includes("lien externe")) {
      description = "Ce document est un lien externe et doit être ouvert dans le navigateur.";
    } else if (lowerRaw.includes("adresse") || lowerRaw.includes("manquante")) {
      description = "Document indisponible (adresse manquante).";
    } else if (isOpenStage) {
      description = raw;
    }
    showFileError(alert, isOpenStage ? "open" : "download", description, raw);
  }
}
