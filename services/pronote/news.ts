import { PronoteApiClient } from "@/services/pronote/api-client";
import { AttachmentType } from "@/services/shared/attachment";
import { News } from "@/services/shared/news";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteNews(
  authToken: string,
  accountId: string,
  childName?: string
): Promise<News[]> {
  try {
    const data = await PronoteApiClient.getNews(authToken, childName);
    return (data.news || []).map((item: any) => ({
      id: item.id,
      title: item.title || "Actualité",
      createdAt: new Date(item.date || Date.now()),
      acknowledged: item.acknowledged ?? true,
      attachments: Array.isArray(item.attachments) ? item.attachments.map((f: any) => ({
        type: f?.type === 0 ? AttachmentType.LINK : AttachmentType.FILE,
        name: f?.name ?? "Fichier",
        url: f?.url ?? "",
        createdByAccount: accountId,
      })) : [],
      content: item.content || "",
      author: item.author || "",
      category: item.category || "Information",
      createdByAccount: accountId,
    }));
  } catch (err) {
    error(`Failed to fetch news: ${err}`, "fetchPronoteNews");
    return [];
  }
}

export async function setPronoteNewsAsAcknowledged(
  authToken: string,
  news: News,
  childName?: string
): Promise<News> {
  try {
    await PronoteApiClient.markNewsRead(authToken, news.id, childName);
  } catch (err) {
    error(`Failed to mark news read: ${err}`, "setPronoteNewsAsAcknowledged");
  }
  return {
    ...news,
    acknowledged: true,
  };
}