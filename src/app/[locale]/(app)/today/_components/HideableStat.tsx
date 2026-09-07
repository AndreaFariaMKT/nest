"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { EyeIcon, EyeOffIcon } from "@/components/icons/NavIcons";

const KEY = "nest-hide-revenue";

/**
 * A stat whose value can be hidden — the monthly revenue on the first screen
 * of the day, which is also the screen most likely to be open when someone
 * walks past the desk.
 *
 * It renders **masked first, on both server and client**, and only reveals
 * after reading localStorage. The other order — visible first, hide on mount —
 * flashes the number for one frame every single load, which is the one thing
 * this control exists to prevent. The cost is a brief mask when the value was
 * meant to be visible, and that is the harmless direction to fail in.
 *
 * The preference is per browser, not per account: it is a shoulder-surfing
 * guard, not a permission. Anyone who can open this page can still click.
 */
export function HideableStat({ label, value }: { label: string; value: string }) {
  const t = useTranslations("today.stats");
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Private windows and blocked site data throw on access rather than
    // returning null, so the read has to be guarded or the card never mounts.
    try {
      setHidden(window.localStorage.getItem(KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // Preference is a convenience; losing it must not break the card.
    }
  }

  return (
    <div
      className="rounded-2xl border border-border bg-card p-5"
      data-testid="today-stat"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={hidden}
          aria-label={hidden ? t("show") : t("hide")}
          title={hidden ? t("show") : t("hide")}
          className="-m-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {hidden ? (
            <EyeOffIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
        </button>
      </div>
      <div
        className="mt-3 font-display text-3xl leading-none text-foreground"
        data-testid="today-stat-value"
      >
        {/* Fixed-width bullets rather than the real string blurred or
            truncated: the mask must not leak the magnitude of the number. */}
        {hidden ? <span aria-hidden>••••••</span> : value}
        {hidden ? <span className="sr-only">{t("hidden")}</span> : null}
      </div>
    </div>
  );
}
