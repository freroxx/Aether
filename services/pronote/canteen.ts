import { PronoteApiClient } from "@/services/pronote/api-client";
import { CanteenMenu } from "@/services/shared/canteen";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteCanteenMenu(
  authToken: string,
  accountId: string,
  date: Date,
  childName?: string
): Promise<CanteenMenu[]> {
  try {
    const fromStr = date.toISOString().split("T")[0];
    const data = await PronoteApiClient.getCanteen(authToken, fromStr, undefined, childName);

    return (data.menus || []).map((m: any) => {
      const lunchMeal = m.meals?.[0];
      const dinnerMeal = m.meals?.[1];

      return {
        date: new Date(m.date),
        createdByAccount: accountId,
        lunch: lunchMeal
          ? {
              entry: (lunchMeal.items || []).slice(0, 2).map((name: string) => ({ name })),
              main: (lunchMeal.items || []).slice(2, 4).map((name: string) => ({ name })),
              side: [],
              cheese: [],
              dessert: (lunchMeal.items || []).slice(4).map((name: string) => ({ name })),
              drink: [],
            }
          : undefined,
        dinner: dinnerMeal
          ? {
              entry: (dinnerMeal.items || []).slice(0, 2).map((name: string) => ({ name })),
              main: (dinnerMeal.items || []).slice(2, 4).map((name: string) => ({ name })),
              side: [],
              cheese: [],
              dessert: (dinnerMeal.items || []).slice(4).map((name: string) => ({ name })),
              drink: [],
            }
          : undefined,
      };
    });
  } catch (err) {
    error(`Failed to fetch canteen menu: ${err}`, "fetchPronoteCanteenMenu");
    return [];
  }
}