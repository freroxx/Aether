import { Model, Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

import { Attachment } from "@/services/shared/attachment";
import { Homework as SharedHomework } from "@/services/shared/homework";
import { generateId } from "@/utils/generateId";
import { warn } from "@/utils/logger/logger";
import { getWeekRange, getWeekRangeForDate, getWeekRangeForWeekNumber } from "@/utils/services/periods";

import { getDatabaseInstance, useDatabase } from "./DatabaseProvider";
import Homework from "./models/Homework";
import { safeWrite } from "./utils/safeTransaction";

function realPronoteId(raw: unknown): string | undefined {
  const s = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  if (!s || s.startsWith("id-")) return undefined;
  return s;
}

function mapHomeworkToShared(homework: Homework): SharedHomework {
  return {
    id: homework.homeworkId,
    pronoteId: realPronoteId((homework as { pronoteId?: unknown }).pronoteId),
    subject: homework.subject,
    content: homework.content,
    dueDate: new Date(homework.dueDate),
    isDone: homework.isDone,
    returnFormat: homework.returnFormat,
    attachments: parseJsonArray(homework.attachments) as Attachment[],
    evaluation: homework.evaluation,
    custom: homework.custom,
    createdByAccount: homework.createdByAccount,
    kidName: homework.kidName,
    fromCache: true,
  };
}

export function getHomeworkRouteId(homework: SharedHomework): string {
  // Scopé par enfant (kid) : deux enfants avec le même devoir ne se
  // collisionnent plus. Voir routeIdsLegacy() pour la migration.
  return generateId(
    homework.subject +
      homework.content +
      homework.createdByAccount +
      homework.dueDate.toDateString() +
      ((homework as { kidName?: unknown }).kidName ?? "")
  );
}

/** Anciens ids (sans kid) pour la migration transparente des lignes existantes. */
export function getHomeworkRouteIdsLegacy(homework: SharedHomework): string[] {
  const noKid = generateId(
    homework.subject +
      homework.content +
      homework.createdByAccount +
      homework.dueDate.toDateString()
  );
  const legacy = generateId(homework.subject + homework.content + homework.createdByAccount);
  return [noKid, legacy];
}

export async function getHomeworkById(id: string): Promise<SharedHomework | undefined> {
  const database = getDatabaseInstance();
  const records = await database
    .get<Homework>("homework")
    .query(Q.where("homeworkId", id))
    .fetch();
  const cachedHomework = records[0] ? mapHomeworkToShared(records[0]) : undefined;

  if (!cachedHomework) return undefined;

  try {
    const { getManager } = await import("@/services/shared");
    const manager = getManager();
    const freshHomeworks = await manager?.getHomeworks(
      getWeekNumberFromDate(cachedHomework.dueDate)
    );
    return freshHomeworks?.find(homework => getHomeworkRouteId(homework) === id)
      ?? freshHomeworks?.find(homework => {
        const pid = (homework as { pronoteId?: unknown }).pronoteId;
        return typeof pid === "string" && pid.length > 0 && (pid === id || pid === cachedHomework.pronoteId);
      })
      ?? cachedHomework;
  } catch (error) {
    warn(`Unable to refresh homework ${id}: ${String(error)}`);
    return cachedHomework;
  }
}

export function useHomeworkForWeek(
  weekNumber: number,
  refresh = 0,
  scope?: { createdByAccount?: string; kidName?: string }
) {
  const database = useDatabase();
  const [homeworks, setHomeworks] = useState<SharedHomework[]>([]);
  const scopeKey = `${scope?.createdByAccount ?? ""}::${scope?.kidName ?? ""}`;

  useEffect(() => {
    const fetchHomeworks = async () => {
      const homeworksFetched = await getHomeworksFromCache(weekNumber, scope);
      setHomeworks(homeworksFetched);
    };
    fetchHomeworks();
  }, [weekNumber, refresh, database, scopeKey]);

  return homeworks;
}

export async function getHomeworksFromCache(
  weekNumber: number,
  scope?: { createdByAccount?: string; kidName?: string }
): Promise<SharedHomework[]> {
  try {
    const database = getDatabaseInstance();
    const { start, end } = getWeekRangeForWeekNumber(weekNumber, new Date());
    const conditions: any[] = [Q.where("dueDate", Q.between(start.getTime(), end.getTime()))];
    if (scope?.createdByAccount) {
      conditions.push(Q.where("createdByAccount", scope.createdByAccount));
    }
    const homeworks = await database
      .get<Homework>("homework")
      .query(...conditions)
      .fetch();

    let shared = homeworks.map(mapHomeworkToShared);
    // Filtre enfant gardé : seulement si le kid demandé existe dans les
    // lignes (sinon selectedChild stale viderait tout).
    if (scope?.kidName) {
      const hasKid = shared.some(h => (h as { kidName?: unknown }).kidName === scope.kidName);
      if (hasKid) {
        shared = shared.filter(h => {
          const kid = (h as { kidName?: unknown }).kidName;
          return typeof kid !== "string" || kid.length === 0 || kid === scope.kidName;
        });
      }
    }
    return shared.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  } catch (e) {
    warn(String(e));
    return [];
  }
}

export async function addHomeworkToDatabase(homeworks: SharedHomework[]) {
  if (!homeworks || homeworks.length === 0) {
    return;
  }
  const db = getDatabaseInstance();

  const { start, end } = getWeekRangeForDate(homeworks[0].dueDate);
  const dbHomeworks = await db.get<Homework>("homework")
    .query(Q.where("dueDate", Q.between(start.getTime(), end.getTime())))
    .fetch();

  const homeworkIds: string[] = [];
  const refreshedKeys = new Set(
    homeworks.map(hw => `${hw.createdByAccount}::${(hw as { kidName?: unknown }).kidName ?? ""}`)
  );
  for (const hw of homeworks) {
    homeworkIds.push(getHomeworkRouteId(hw), ...getHomeworkRouteIdsLegacy(hw));
  }

  const homeworksToDelete = dbHomeworks.filter(
    dbHomework =>
      refreshedKeys.has(`${dbHomework.createdByAccount}::${(dbHomework as unknown as { kidName?: unknown }).kidName ?? ""}`) &&
      !homeworkIds.includes(dbHomework.homeworkId)
  );

  if (homeworksToDelete.length > 0) {
    await Promise.all(homeworksToDelete.map(homework => homework.markAsDeleted()));
  }

  for (const hw of homeworks) {
    const id = getHomeworkRouteId(hw);
    const legacyIds = getHomeworkRouteIdsLegacy(hw);

    const existing = await db
      .get("homework")
      .query(Q.where("homeworkId", Q.oneOf([id, ...legacyIds])))
      .fetch();

    if (existing.length > 1) {
      // Doublons inter-enfants historiques : on ne garde que le 1er.
      await Promise.all(existing.slice(1).map(dup => dup.markAsDeleted()));
    }

    if (existing.length === 0) {
      await safeWrite(
        db,
        async () => {
          await db.get("homework").create((record: Model) => {
            const homework = record as Homework;
            Object.assign(homework, {
              homeworkId: id,
              pronoteId: realPronoteId((hw as { pronoteId?: unknown }).pronoteId ?? (hw as { id?: unknown }).id) ?? "",
              subject: hw.subject,
              content: hw.content,
              dueDate: hw.dueDate.getTime(),
              isDone: hw.isDone,
              returnFormat: hw.returnFormat,
              attachments: JSON.stringify(hw.attachments),
              evaluation: hw.evaluation,
              custom: hw.custom,
              createdByAccount: hw.createdByAccount,
              kidName: hw.kidName,
              fromCache: true,
            });
          });
        },
        10000,
        "addHomeworkToDatabase"
      );
    } else {
      const recordToUpdate = existing[0];
      await safeWrite(
        db,
        async () => {
          await recordToUpdate.update((record: Model) => {
            const homework = record as Homework;
            const freshPronoteId = realPronoteId((hw as { pronoteId?: unknown }).pronoteId ?? (hw as { id?: unknown }).id);
            Object.assign(homework, {
              ...(freshPronoteId ? { pronoteId: freshPronoteId } : {}),
              homeworkId: id,
              subject: hw.subject,
              content: hw.content,
              dueDate: hw.dueDate.getTime(),
              isDone: hw.isDone,
              returnFormat: hw.returnFormat,
              attachments: JSON.stringify(hw.attachments),
              evaluation: hw.evaluation,
              custom: hw.custom,
              createdByAccount: hw.createdByAccount,
              kidName: hw.kidName,
              fromCache: true,
            });
          });
        },
        10000,
        "updateHomeworkToDatabase"
      );
    }
  }
}

export async function updateHomeworkIsDone(
  homeworkId: string,
  isDone: boolean
) {
  const db = getDatabaseInstance();

  const existing = await db
    .get("homework")
    .query(Q.where("homeworkId", homeworkId))
    .fetch();

  if (existing.length === 0) {
    warn(`Homework with ID ${homeworkId} not found`);
    return;
  }

  const recordToUpdate = existing[0];

  await safeWrite(
    db,
    async () => {
      await recordToUpdate.update((record: Model) => {
        const homework = record as Homework;
        homework.isDone = isDone;
      });
    },
    10000,
    "updateHomeworkIsDone"
  );
}

export function getDateRangeOfWeek(
  weekNumber: number,
  year = new Date().getFullYear()
) {
  return getWeekRange(weekNumber, year);
}

export function parseJsonArray(s: string): unknown[] {
  try {
    const result = JSON.parse(s);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export function getWeekNumberFromDate(date: Date): number {
  try {
    // ISO 8601 partagé avec getWeekRange (lundi-start). L'ancien calcul
    // dimanche-start décalait tous les dimanches d'une semaine (EDT vide).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getISOWeekYear } = require("@/utils/services/periods");
    return getISOWeekYear(date).week;
  } catch {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor(
      (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  }
}

export function getISOYearFromDate(date: Date): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getISOWeekYear } = require("@/utils/services/periods");
    return getISOWeekYear(date).year;
  } catch {
    return date.getFullYear();
  }
}
