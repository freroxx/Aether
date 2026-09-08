/**
 * True-background sync ("aether-sync", 15 min) + install-free fallback.
 *
 * État de l'install (vérifié) : `expo-background-fetch` et
 * `expo-task-manager` sont ABSENTS de package.json (expo-notifications@57
 * seul). Aucune dépendance n'est ajoutée ici (pas d'install réseau) :
 * - si les deux modules sont un jour installés, `registerBackgroundSyncAsync`
 *   définit + enregistre la tâche headless `aether-sync` (minimumInterval
 *   15 min, stopOnTerminate false sur Android) qui rejoue EXACTEMENT les
 *   mêmes vérifications que le foreground via {@link runNewItemsCheck}
 *   (aucune logique dupliquée) et retourne NewData/NoData/Failed honnêtement ;
 * - sinon (état actuel), l'enregistrement retourne `"unavailable"` et le
 *   foreground (intervalles 15 min dans AppProviders) reste le moteur, avec
 *   `setNotificationHandler` (déjà enregistré dans
 *   `services/local/notifications.ts`) qui couvre la présentation.
 *
 * Le chargement optionnel passe par `new Function("require")` (chaîne non
 * analysée par tsc/Metro) : aucun import statique vers un paquet absent, donc
 * aucun crash de bundling — Expo Go / dev safe. La définition de tâche au
 * scope module garantit que les lancements headless (qui réévaluent le
 * bundle sans monter React) retrouvent la tâche.
 */

export const AETHER_SYNC_TASK = "aether-sync";
export const BACKGROUND_MINIMUM_INTERVAL_SECONDS = 15 * 60;

export type BackgroundSyncOutcome = "new-data" | "no-data" | "failed";
export type BackgroundRegistration = "registered" | "unavailable" | "skipped";

/** `require` optionnel : `null` si le module est absent (install actuelle). */
function optionalRequire(id: string): unknown {
  try {
    const loader = new Function(
      "id",
      "try { return require(id); } catch (e) { return null; }",
    ) as (id: string) => unknown;
    return loader(id) ?? null;
  } catch {
    return null;
  }
}

/**
 * Corps headless de `aether-sync` : initialise le manager en lecture seule
 * (via les imports lazy de `loadHomeworks`/`loadGrades`) et rejoue les MÊMES
 * vérifications que le foreground. Ne jette jamais (Failed seulement sur
 * erreur inattendue).
 */
export async function runBackgroundSyncTask(): Promise<BackgroundSyncOutcome> {
  try {
    const { runNewItemsCheck } = await import("./notifications");
    const result = await runNewItemsCheck();
    return result.hadNew ? "new-data" : "no-data";
  } catch {
    return "failed";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

let taskDefined = false;

/** Définit `aether-sync` via expo-task-manager si disponible. Garde isTaskDefined. */
function ensureTaskDefined(): boolean {
  if (taskDefined) return true;
  try {
    const TaskManager = asRecord(optionalRequire("expo-task-manager"));
    const BackgroundFetch = asRecord(optionalRequire("expo-background-fetch"));
    if (!TaskManager || !BackgroundFetch) return false;
    const isTaskDefined = TaskManager["isTaskDefined"];
    const alreadyDefined =
      typeof isTaskDefined === "function"
        ? (isTaskDefined as (name: string) => boolean).call(
            TaskManager,
            AETHER_SYNC_TASK,
          )
        : false;
    const defineTask = TaskManager["defineTask"];
    if (!alreadyDefined && typeof defineTask === "function") {
      (defineTask as (name: string, executor: () => Promise<number>) => void).call(
        TaskManager,
        AETHER_SYNC_TASK,
        async () => {
          const outcome = await runBackgroundSyncTask();
          const fetchModule = asRecord(optionalRequire("expo-background-fetch"));
          const Result = fetchModule?.["Result"] as
            | { NewData?: number; NoData?: number; Failed?: number }
            | undefined;
          if (outcome === "new-data") return Result?.NewData ?? 1;
          if (outcome === "failed") return Result?.Failed ?? 3;
          return Result?.NoData ?? 2;
        },
      );
    }
    taskDefined = true;
    return true;
  } catch {
    return false;
  }
}

// Définition au scope module pour les lancements headless. No-op tant que
// expo-task-manager / expo-background-fetch sont absents.
try {
  ensureTaskDefined();
} catch {
  // Expo Go / dev safe
}

/**
 * Enregistre `aether-sync` (15 min, stopOnTerminate false Android,
 * startOnBoot true). Ne jette jamais :
 * - `"registered"` : tâche enregistrée ;
 * - `"unavailable"` : expo-background-fetch / expo-task-manager absents
 *   (état actuel → fallback foreground) ;
 * - `"skipped"` : statut OS refusé/restreint ou erreur (Expo Go/dev).
 */
export async function registerBackgroundSyncAsync(): Promise<BackgroundRegistration> {
  try {
    const BackgroundFetch = asRecord(optionalRequire("expo-background-fetch"));
    if (!BackgroundFetch || typeof BackgroundFetch["registerTaskAsync"] !== "function") {
      return "unavailable";
    }
    if (!ensureTaskDefined()) return "unavailable";
    try {
      const getStatusAsync = BackgroundFetch["getStatusAsync"];
      const Status = BackgroundFetch["Status"] as
        | { Denied?: number; Restricted?: number }
        | undefined;
      if (typeof getStatusAsync === "function" && Status) {
        const status = await (
          getStatusAsync as () => Promise<number>
        ).call(BackgroundFetch);
        if (status === Status.Denied || status === Status.Restricted) {
          return "skipped";
        }
      }
    } catch {
      // statut illisible : on tente quand même l'enregistrement
    }
    await (
      BackgroundFetch["registerTaskAsync"] as (
        name: string,
        options?: Record<string, unknown>,
      ) => Promise<void>
    ).call(BackgroundFetch, AETHER_SYNC_TASK, {
      minimumInterval: BACKGROUND_MINIMUM_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return "registered";
  } catch {
    return "skipped";
  }
}
