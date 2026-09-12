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
      id: s.id ?? null,
      name: s.name ?? "",
      subject: s.subject ?? "",
      subjects: Array.isArray(s.subjects)
        ? s.subjects.map((sub: any) => ({
          id: sub.id ?? null,
          name: sub.name ?? "",
          parentSubjectId: sub.parent_subject_id ?? null,
          parentSubjectName: sub.parent_subject_name ?? null,
        }))
        : undefined,
      type: s.type ?? null,
      email: s.email ?? "",
    }));
  } catch (err) {
    error(`Failed to fetch teaching staff: ${err}`, "fetchPronoteTeachingStaff");
    return [];
  }
}

export async function fetchPronoteProfile(
  authToken: string,
  childName?: string
) {
  const { PronoteApiClient: C } = await import("@/services/pronote/api-client");
  return C.getProfile(authToken, childName);
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
