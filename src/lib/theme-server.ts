import { cookies } from "next/headers";

import { DEFAULT_THEME, THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";

/** Read the active brand theme from the cookie (server-side). */
export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}
