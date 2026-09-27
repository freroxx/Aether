import { PronoteApiClient } from "@/services/pronote/api-client";
import { AttachmentType } from "@/services/shared/attachment";
import { Homework, ReturnFormat } from "@/services/shared/homework";
import { getWeekRangeForWeekNumber } from "@/utils/services/periods";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteHomeworks(
  authToken: string,
  accountId: string,
  weekNumberRaw: number,
  childName?: string
): Promise<Homework[]> {
  try {
    // Année ISO inférée (proximité à aujourd'hui) : `weekNumber` seul est
    // ambigu (semaine 1 en décembre = janvier suivant, pas janvier passé).
    const { start, end } = getWeekRangeForWeekNumber(weekNumberRaw, new Date());
    // Dates locales (pas toISOString/UTC) : 00:00 local = veille 22-23h UTC
    // -> semaine décalée -1j en Europe. Même fix que timetable/cantine.
    const fmtLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fromStr = fmtLocal(start);
    const toStr = fmtLocal(end);

    const data = await PronoteApiClient.getHomework(authToken, fromStr, toStr, childName);
    return (data.homework || []).map((h: any) => ({
      id: h.id,
      pronoteId: h.id,
      kidName: childName,
      subject: h.subject || "Matière",
      content: h.description || "",
      dueDate: (() => {
        const d = new Date(h.date);
        return isNaN(d.getTime()) ? new Date() : d;
      })(),
      isDone: h.done ?? false,
      returnFormat: ReturnFormat.PAPER,
      attachments: (h.files || []).map((f: any) => {
        const url: string = String(f?.url ?? "");
        const isExternalLink =
          f?.type === 0 ||
          f?.type === "link" ||
          f?.type === "LINK" ||
          (/^https?:\/\//i.test(url) && !/index-education\.net/i.test(url));
        return {
          type: isExternalLink ? AttachmentType.LINK : AttachmentType.FILE,
          name: f.name,
          url: f.url,
          createdByAccount: accountId,
        };
      }),
      evaluation: false,
      custom: false,
      createdByAccount: accountId,
    }));
  } catch (err) {
    error(`Failed to fetch homework: ${err}`, "fetchPronoteHomeworks");
    return [];
  }
}

export async function setPronoteHomeworkAsDone(
  authToken: string,
  homework: Homework,
  status?: boolean,
  childName?: string
): Promise<Homework> {
  const nextStatus = status !== undefined ? status : !homework.isDone;
  // Vrai id Pronote si connu (sinon le backend cherche ±60j), + due_date en indice.
  const realId = (homework as { pronoteId?: unknown }).pronoteId ?? homework.id;
  let dueDateStr: string | undefined;
  try {
    const d = homework.dueDate instanceof Date ? homework.dueDate : new Date(homework.dueDate as any);
    if (!isNaN(d.getTime())) dueDateStr = d.toISOString().split("T")[0];
  } catch {
    dueDateStr = undefined;
  }
  try {
    await PronoteApiClient.setHomeworkDone(authToken, String(realId), nextStatus, childName, dueDateStr);
  } catch (err) {
    error(`Failed to set homework done: ${err}`, "setPronoteHomeworkAsDone");
    throw err;
  }

  return {
    ...homework,
    isDone: nextStatus,
    progress: nextStatus ? 1 : 0,
  };
}