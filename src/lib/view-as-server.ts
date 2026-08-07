import { cookies } from "next/headers";

import { VIEW_AS_COOKIE, isViewAsRole, type ViewAsRole } from "@/lib/view-as";

/** The previewed role from the cookie, or null when viewing as yourself. */
export async function getViewAs(): Promise<ViewAsRole | null> {
  const store = await cookies();
  const v = store.get(VIEW_AS_COOKIE)?.value;
  return isViewAsRole(v) ? v : null;
}
