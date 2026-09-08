import { PronoteApiClient } from "@/services/pronote/api-client";
import { AttachmentType } from "@/services/shared/attachment";
import { Homework, ReturnFormat } from "@/services/shared/homework";
import { getWeekRange } from "@/utils/services/periods";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteHomeworks(
  authToken: string,
  accountId: string,
  weekNumberRaw: number,
  childName?: string
): Promise<Homework[]> {
  try {
    const { start, end } = getWeekRange(weekNumberRaw, new Date().getFullYear());
    const fromStr = start.toISOString().split("T")[0];
    const toStr = end.toISOString().split("T")[0];

    const data = await PronoteApiClient.getHomework(authToken, fromStr, toStr, childName);
    return (data.homework || []).map((h: any) => ({
      id: h.id,
      subject: h.subject || "Matière",
      content: h.description || "",
      dueDate: new Date(h.date),
      isDone: h.done ?? false,
      returnFormat: ReturnFormat.PAPER,
      attachments: (h.files || []).map((f: any) => ({
        type: AttachmentType.FILE,
        name: f.name,
        url: f.url,
        createdByAccount: accountId,
      })),
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
  try {
    await PronoteApiClient.setHomeworkDone(authToken, homework.id, nextStatus, childName);
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