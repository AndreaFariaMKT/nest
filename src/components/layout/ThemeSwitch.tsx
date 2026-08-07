"use client";

import { useState } from "react";

import { THEMES, THEME_LABEL, type Theme } from "@/lib/theme";

/**
 * Brand theme toggle (Nest ⇄ AFM). Flips the `data-theme` attribute on <html>
 * for an instant re-theme and persists the choice in a cookie for SSR.
 */
export function ThemeSwitch({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  function pick(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `nest-theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
      {THEMES.map((t) => (
        <button
          key={t}
          onClick={() => pick(t)}
          aria-pressed={theme === t}
          className={
            theme === t
              ? "rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground"
              : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          }
        >
          {THEME_LABEL[t]}
        </button>
      ))}
    </div>
  );
}
