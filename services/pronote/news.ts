import { PronoteApiClient } from "@/services/pronote/api-client";
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
      attachments: [],
      content: item.content || "",
      author: item.author || "",
      category: "Information",
      createdByAccount: accountId,
    }));
  } catch (err) {
    error(`Failed to fetch news: ${err}`, "fetchPronoteNews");
    return [];
  }
}

export async function setPronoteNewsAsAcknowledged(
  authToken: string,
  news: News
): Promise<News> {
  return {
    ...news,
    acknowledged: true,
  };
}