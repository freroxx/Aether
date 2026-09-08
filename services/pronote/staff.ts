import { PronoteApiClient } from "@/services/pronote/api-client";
import { TeachingStaff } from "@/services/shared/staff";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteTeachingStaff(
  authToken: string,
  childName?: string
): Promise<TeachingStaff[]> {
  try {
    const data = await PronoteApiClient.getTeachingStaff(authToken, childName);
    return (data.staff || []).map((s: any) => ({
      name: s.name ?? "",
      subject: s.subject ?? "",
      email: s.email ?? "",
    }));
  } catch (err) {
    error(`Failed to fetch teaching staff: ${err}`, "fetchPronoteTeachingStaff");
    return [];
  }
}

export async function fetchPronoteIcalUrl(
  authToken: string,
  childName?: string
): Promise<string | null> {
  try {
    const data = await PronoteApiClient.getIcalUrl(authToken, childName);
    return data.url ?? null;
  } catch (err) {
    error(`Failed to fetch ical url: ${err}`, "fetchPronoteIcalUrl");
    return null;
  }
}
