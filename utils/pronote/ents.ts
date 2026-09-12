import { PronoteApiClient } from "@/services/pronote/api-client";

/**
 * Liste ENT de repli (locale) — la liste de référence reste celle du backend
 * (`GET /meta/ents`, reflet de `pronotepy.ent`, voir backend/api/index.py).
 * Utilisée uniquement si le backend est injoignable.
 */
export const FALLBACK_ENTS: string[] = [
  "ile_de_france",
  "paris_classe_numerique",
  "ent_auvergne_rhone_alpe",
  "ent_auvergne_rhone_alpes",
  "occitanie_montpellier",
  "occitanie_toulouse",
  "ent_hdf",
  "ent_essonne",
  "ent77",
  "ent78",
  "ent93",
  "ent94",
  "ent95",
  "ent_bretagne",
  "ent_normandie",
  "ent_bourgogne",
  "ent_centre",
  "ent_pays_de_la_loire",
  "ent_grand_est",
  "ent_nouvelle_aquitaine",
  "ent_paca",
  "ent_corse",
  "ent_creuse",
  "ent_reunion",
  "ent_mayotte",
  "ent_guadeloupe",
  "ent_martinique",
  "ent_guyane",
  "ent_savoie",
  "ent_isere",
  "ent_ain",
  "ent_loire",
  "ent_rhone",
  "ent_drome_ardeche",
  "arsene76",
  "monbureaunumerique",
  "neoconnect",
  "ecollege_haute_garonne",
  "somme_num",
];

/** Liste ENT via backend (`/meta/ents` puis `/meta`), repli local sinon. */
export async function fetchEntList(): Promise<{ ents: string[]; fromFallback: boolean }> {
  try {
    const res = await PronoteApiClient.getEnts();
    if (res?.ents && res.ents.length > 0) return { ents: [...res.ents].sort(), fromFallback: false };
  } catch {
    // tente /meta (même payload `ents`)
  }
  try {
    const meta = await PronoteApiClient.getMeta();
    if (meta?.ents && meta.ents.length > 0) return { ents: [...meta.ents].sort(), fromFallback: false };
  } catch {
    // repli local ci-dessous
  }
  return { ents: FALLBACK_ENTS, fromFallback: true };
}

/** Erreur 400 « ENT inconnu » du backend (voir backend/api/index.py `/auth/login`). */
export function isUnknownEntError(e: unknown): boolean {
  const status = (e as any)?.status;
  const raw = String((e as any)?.detail || (e as any)?.message || e || "").toLowerCase();
  if (status === 400 && (raw.includes("ent") || raw.includes("inconnu") || raw.includes("unknown"))) return true;
  return raw.includes("inconnu de pronotepy") || raw.includes("unknown ent") || raw.includes("voir /meta/ents");
}

export function describeEntError(entName: string, fallback = false): string {
  return (
    `ENT « ${entName} » inconnu de pronotepy. Vérifie l'orthographe exacte ` +
    `(sensible à la casse, ex. ile_de_france)` +
    (fallback ? " — liste locale affichée, backend injoignable." : " — voir /meta/ents pour la liste exacte.") +
    ` Ou laisse le champ ENT vide pour une connexion directe.`
  );
}
