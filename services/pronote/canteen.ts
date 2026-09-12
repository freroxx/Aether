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
    const toDate = new Date(date);
    toDate.setDate(toDate.getDate() + 6);
    const toStr = toDate.toISOString().split("T")[0];

    const data = await PronoteApiClient.getCanteen(authToken, fromStr, toStr, childName);

    return (data.menus || []).map((m: any) => {
      const mapFood = (f: any) => ({
        id: typeof f?.id === "string" ? f.id : null,
        name: typeof f === "string" ? f : (f?.name ?? ""),
        allergens: Array.isArray(f?.labels) ? f.labels.map((l: any) => (typeof l === "string" ? l : l?.name ?? "")) : (f?.labels || []),
        labels: Array.isArray(f?.labels) ? f.labels.map((l: any) => (typeof l === "string" ? { name: l } : { id: l?.id ?? null, name: l?.name ?? "", color: l?.color ?? null })) : undefined,
      });
      let lunchMeal = undefined;
      let dinnerMeal = undefined;

      if (m.meal) {
        const mealObj = {
          entry: (m.meal.entry || []).map(mapFood),
          main: (m.meal.main || []).map(mapFood),
          side: (m.meal.side || []).map(mapFood),
          cheese: (m.meal.cheese || []).map(mapFood),
          dessert: (m.meal.dessert || []).map(mapFood),
          other: (m.meal.other || []).map(mapFood),
          drink: [],
        };
        if (m.is_lunch ?? true) lunchMeal = mealObj;
        if (m.is_dinner ?? false) dinnerMeal = mealObj;
      } else if (m.meals) {
        const rawLunch = m.meals?.[0];
        const rawDinner = m.meals?.[1];
        if (rawLunch) {
          lunchMeal = {
            entry: (rawLunch.items || []).slice(0, 2).map((name: string) => ({ name })),
            main: (rawLunch.items || []).slice(2, 4).map((name: string) => ({ name })),
            side: [],
            cheese: [],
            dessert: (rawLunch.items || []).slice(4).map((name: string) => ({ name })),
            drink: [],
          };
        }
        if (rawDinner) {
          dinnerMeal = {
            entry: (rawDinner.items || []).slice(0, 2).map((name: string) => ({ name })),
            main: (rawDinner.items || []).slice(2, 4).map((name: string) => ({ name })),
            side: [],
            cheese: [],
            dessert: (rawDinner.items || []).slice(4).map((name: string) => ({ name })),
            drink: [],
          };
        }
      }

      return {
        date: new Date(m.date),
        createdByAccount: accountId,
        lunch: lunchMeal,
        dinner: dinnerMeal,
      };
    });
  } catch (err) {
    error(`Failed to fetch canteen menu: ${err}`, "fetchPronoteCanteenMenu");
    return [];
  }
}