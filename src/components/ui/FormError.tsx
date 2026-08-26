"use client";

import { useTranslations } from "next-intl";

import { isDbError } from "@/lib/db-error";

/**
 * A refusal a person can act on.
 *
 * Eight forms rendered `{state.error}` straight into the page, and their
 * actions returned `error.message` from Postgres — so a failed save showed
 * English text naming tables, columns and constraint names inside a
 * Portuguese UI: "new row violates row-level security policy for table
 * tasks". These are the month-one paths: a new client, a contract, a task, a
 * service, a meeting, a brand kit.
 *
 * `db-error.ts` was written for exactly this and had only ever been wired into
 * the social module, which has its own `Refusal`. This is that idea for the
 * forms outside it.
 *
 * Anything that is not a known SQLSTATE key passes through unchanged: several
 * of these actions also return their own sentences, and swallowing those
 * behind a generic "could not save" would lose the more useful message.
 */
export function FormError({ error }: { error?: string | null }) {
  const t = useTranslations("common.db");
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {isDbError(error) ? t(error) : error}
    </p>
  );
}
