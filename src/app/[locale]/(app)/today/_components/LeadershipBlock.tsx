"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { EyeIcon, EyeOffIcon } from "@/components/icons/NavIcons";

const KEY = "nest-hide-revenue";

export type LeadershipFigures = {
  activeProjects: number;
  negotiatingProjects: number;
  /** What the month earned, paid or not — competência. */
  expectedRevenue: string;
  /** What actually landed in the bank this month — caixa. */
  cashRevenue: string;
};

/**
 * The leadership block: two counts and two revenue figures, in one panel with
 * its own treatment rather than as four more cards in the row below.
 *
 * The two revenue numbers are deliberately different measurements of the same
 * month, and the labels say which is which — "esperada" is what the month
 * earned and "em caixa" is what arrived. A studio that reads only the first
 * plans against money it has not been paid; one that reads only the second
 * cannot tell a slow payer from a bad month.
 *
 * The eye hides both money figures at once. It shares its stored preference
 * with the revenue card that had it first, so hiding in one place hides
 * everywhere — a toggle that hid one of two revenue numbers on the same screen
 * would be theatre.
 */
export function LeadershipBlock({ figures }: { figures: LeadershipFigures }) {
  const t = useTranslations("today.leadership");
  const tStats = useTranslations("today.stats");
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
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
      // A lost preference must not break the panel.
    }
  }

  const mask = "••••••";

  return (
    <section className="mb-6 rounded-2xl border border-brand/25 bg-brand-soft/40 p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-brand-soft-foreground">
          {t("title")}
        </h2>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={hidden}
          aria-label={hidden ? tStats("show") : tStats("hide")}
          title={hidden ? tStats("show") : tStats("hide")}
          className="-m-1 rounded-md p-1 text-brand-soft-foreground/70 transition-colors hover:text-brand-soft-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {hidden ? (
            <EyeOffIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-brand-soft-foreground/70">
            {t("activeProjects")}
          </dt>
          <dd className="mt-1.5 font-display text-3xl leading-none text-foreground">
            {figures.activeProjects}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-brand-soft-foreground/70">
            {t("negotiating")}
          </dt>
          <dd className="mt-1.5 font-display text-3xl leading-none text-foreground">
            {figures.negotiatingProjects}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-brand-soft-foreground/70">
            {t("expected")}
          </dt>
          <dd className="mt-1.5 font-display text-2xl leading-none text-foreground">
            {hidden ? <span aria-hidden>{mask}</span> : figures.expectedRevenue}
          </dd>
          <dd className="mt-1 text-[11px] text-brand-soft-foreground/70">
            {t("expectedHint")}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-brand-soft-foreground/70">
            {t("cash")}
          </dt>
          <dd className="mt-1.5 font-display text-2xl leading-none text-foreground">
            {hidden ? <span aria-hidden>{mask}</span> : figures.cashRevenue}
          </dd>
          <dd className="mt-1 text-[11px] text-brand-soft-foreground/70">
            {t("cashHint")}
          </dd>
        </div>
      </dl>
      {hidden ? (
        <span className="sr-only">{tStats("hidden")}</span>
      ) : null}
    </section>
  );
}
