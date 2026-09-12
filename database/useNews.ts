import { Model, Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

import { Attachment } from "@/services/shared/attachment";
import { News as SharedNews } from "@/services/shared/news";
import { generateId } from "@/utils/generateId";
import { info,warn } from "@/utils/logger/logger";

import { getDatabaseInstance, useDatabase } from "./DatabaseProvider";
import News from "./models/News";
import { useAccountStore } from "@/stores/account";
import { parseJsonArray } from "./useHomework";
import { safeWrite } from "./utils/safeTransaction";

export function useNews(refresh = 0) {
  const database = useDatabase();
  const [news, setNews] = useState<SharedNews[]>([]);
  // Anti-fuite : ne montrer que les actus du compte actif (les mocks démo
  // ont createdByAccount = mock-id et ne doivent jamais fuir vers Pronote)
  const lastUsedAccount = useAccountStore(s => s.lastUsedAccount);

  useEffect(() => {

    const query = database.get<News>('news').query();

    const sub = query.observe().subscribe(all =>
      setNews(
        all
          .map(mapNewsToShared)
          .filter(item => !lastUsedAccount || item.createdByAccount === lastUsedAccount)
          .sort((a, b) => {
            const ta = a?.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a?.createdAt).getTime();
            const tb = b?.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b?.createdAt).getTime();
            return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
          })
      )
    );

    return () => sub.unsubscribe();
  }, [refresh, database, lastUsedAccount]);

  return news;
}

export function getNewsRouteId(item: SharedNews): string {
  return generateId(item.author + item.title + item.createdByAccount);
}

export async function getNewsById(id: string): Promise<SharedNews | undefined> {
  const database = getDatabaseInstance();
  const records = await database
    .get<News>('news')
    .query(Q.where("newsId", id))
    .fetch();
  const cachedNews = records[0] ? mapNewsToShared(records[0]) : undefined;

  try {
    const { getManager } = await import("@/services/shared");
    const freshNews = await getManager()?.getNews();
    return freshNews?.find(item => getNewsRouteId(item) === id) ?? cachedNews;
  } catch (error) {
    warn(`Unable to refresh news ${id}: ${String(error)}`);
    return cachedNews;
  }
}

export async function addNewsToDatabase(news: SharedNews[]) {
  const db = getDatabaseInstance();

  const itemsToCreate: Array<{ id: string; item: SharedNews }> = [];
  const itemsToUpdate: Array<{ record: Model; item: SharedNews }> = [];

  for (const item of news) {
    const id = getNewsRouteId(item);

    const existingRecords = await db.get('news')
      .query(Q.where("newsId", id))
      .fetch();

    if (existingRecords.length === 0) {
      itemsToCreate.push({ id, item });
    } else {
      itemsToUpdate.push({ record: existingRecords[0], item });
    }
  }

  if (itemsToCreate.length > 0 || itemsToUpdate.length > 0) {
    await safeWrite(
      db,
      async () => {
        const createPromises = itemsToCreate.map(({ id, item }) =>
          db.get('news').create((record: Model) => {
            const newsModel = record as News;
            newsModel.newsId = id;
            newsModel.title = item.title ?? "";
            newsModel.createdAt = item.createdAt.getTime();
            newsModel.acknowledged = item.acknowledged;
            newsModel.attachments = JSON.stringify(item.attachments ?? []);
            newsModel.content = item.content ?? "";
            newsModel.author = item.author ?? "";
            newsModel.category = item.category ?? "";
            newsModel.createdByAccount = item.createdByAccount ?? "";
            newsModel.question = item.question ?? item.survey ?? false;
            newsModel.survey = item.survey ?? false;
            newsModel.anonymousResponse = item.anonymousResponse ?? false;
            newsModel.template = item.template ?? false;
            newsModel.sharedTemplate = item.sharedTemplate ?? false;
            newsModel.creationDate = item.creationDate?.getTime();
            newsModel.endDate = item.endDate instanceof Date ? item.endDate.getTime() : undefined;
          })
        );

        const updatePromises = itemsToUpdate.map(({ record, item }) =>
          record.update((model: Model) => {
            const newsModel = model as News;
            newsModel.title = item.title ?? newsModel.title;
            newsModel.createdAt = item.createdAt.getTime();
            newsModel.acknowledged = item.acknowledged;
            newsModel.attachments = JSON.stringify(item.attachments ?? []);
            newsModel.content = item.content ?? newsModel.content;
            newsModel.author = item.author ?? newsModel.author;
            newsModel.category = item.category ?? newsModel.category;
            newsModel.createdByAccount = item.createdByAccount ?? newsModel.createdByAccount;
            newsModel.question = item.question ?? item.survey ?? newsModel.question;
            newsModel.survey = item.survey ?? newsModel.survey;
            newsModel.anonymousResponse = item.anonymousResponse ?? newsModel.anonymousResponse;
            newsModel.template = item.template ?? newsModel.template;
            newsModel.sharedTemplate = item.sharedTemplate ?? newsModel.sharedTemplate;
            if (item.creationDate) newsModel.creationDate = item.creationDate.getTime();
            if (item.endDate instanceof Date) newsModel.endDate = item.endDate.getTime();
          })
        );

        await Promise.all([...createPromises, ...updatePromises]);
      },
      10000,
      `add_news_${itemsToCreate.length}_create_${itemsToUpdate.length}_update`
    );
  } else {
    info(`🍉 No news items to process`);
  }
}


export async function getNewsFromCache(): Promise<SharedNews[]> {
  try {
    const database = getDatabaseInstance();
    const { useAccountStore } = await import("@/stores/account");
    const lastUsedAccount = useAccountStore.getState().lastUsedAccount;

    const news = await database
      .get<News>('news')
      .query()
      .fetch();

    return news
      .map(mapNewsToShared)
      .filter(item => !lastUsedAccount || item.createdByAccount === lastUsedAccount)
      .sort((a, b) => {
        const ta = a?.createdAt instanceof Date ? a.createdAt.getTime() : NaN;
        const tb = b?.createdAt instanceof Date ? b.createdAt.getTime() : NaN;
        return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
      });
  } catch (e) {
    warn(String(e));
    return [];
  }
}

/** Supprime les actus orphelines (ex-démos supprimés) : garde uniquement les comptes connus. */
export async function purgeOrphanNews(): Promise<void> {
  try {
    const { useAccountStore } = await import("@/stores/account");
    const known = new Set(useAccountStore.getState().accounts.map(a => a.id));
    const database = getDatabaseInstance();
    const all = await database.get<News>('news').query().fetch();
    const orphans = all.filter(r => {
      const owner = (r as News).createdByAccount;
      return owner && !known.has(owner);
    });
    if (orphans.length === 0) return;
    await safeWrite(
      database,
      async () => {
        await Promise.all(orphans.map(r => r.destroyPermanently()));
      },
      10000,
      `purge_orphan_news_${orphans.length}`
    );
  } catch (e) {
    warn(String(e));
  }
}

function mapNewsToShared(news: News): SharedNews {
  return {
    id: news.newsId,
    title: news.title,
    createdAt: new Date(news.createdAt),
    acknowledged: news.acknowledged,
    attachments: parseJsonArray(news.attachments) as Attachment[],
    content: news.content,
    author: news.author,
    category: news.category,
    createdByAccount: news.createdByAccount,
    fromCache: true,
    question: news.question,
    survey: news.survey,
    anonymousResponse: news.anonymousResponse,
    template: news.template,
    sharedTemplate: news.sharedTemplate,
    creationDate: news.creationDate ? new Date(news.creationDate) : undefined,
    endDate: news.endDate ? new Date(news.endDate) : undefined,
  };
}
