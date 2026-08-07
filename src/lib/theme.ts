/** Brand theme constants. Pure module (no server-only imports). */
export const THEMES = ["nest", "afm"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "nest";
export const THEME_COOKIE = "nest-theme";

export const THEME_LABEL: Record<Theme, string> = {
  nest: "Nest",
  afm: "AFM",
};

export function isTheme(v: string | undefined): v is Theme {
  return v === "nest" || v === "afm";
}
