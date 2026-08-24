"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { isBlockedReason } from "@/lib/social";
import { isDbError } from "@/lib/db-error";
import type { Result } from "../actions";

export const initialResult: Result = { ok: false };

/**
 * The module speaks in three moves — the one you probably want, the neutral
 * one, and the one that sends something back. They map onto the shared Button
 * so every one carries the focus ring the rest of the app has.
 */
export type Variant = "primary" | "secondary" | "danger";

const VARIANT: Record<Variant, "brand" | "secondary" | "danger"> = {
  primary: "brand",
  secondary: "secondary",
  danger: "danger",
};

export function Btn({
  variant = "secondary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <Button
      type="submit"
      variant={VARIANT[variant]}
      className={cn("h-9 px-3", className)}
      {...rest}
    />
  );
}

/** Renders a refusal as a sentence. `error` is always an i18n key now. */
export function Refusal({ error }: { error?: string }) {
  const t = useTranslations("social.blocked");
  if (!error) return null;
  // Both dictionaries live under social.blocked: the domain's own refusals and
  // the six database ones. Postgres messages no longer reach here — they name
  // tables, columns and constraints, and the portal renders this component for
  // clients. The real error is in the log, keyed by area.
  const key = isBlockedReason(error) || isDbError(error) ? error : "dbFailed";
  // role="alert" because this appears after a round trip, in response to
  // something the reader did. Without it a screen reader announces nothing at
  // all: the button re-enables, the page looks unchanged, and the refusal is
  // invisible to the person who most needs it read aloud.
  return (
    <p role="alert" className="mt-2 text-xs text-destructive">
      {t(key)}
    </p>
  );
}

/**
 * Every form in the module does the same two things: run a server action, and
 * show the refusal when it does not succeed.
 *
 * It used to do a third — call `router.refresh()` on success — and that was
 * redundant. A server action that called `revalidatePath` already returns a
 * freshly rendered tree for the CURRENT route in its own response (Next sets
 * `skipFlight: !pathWasRevalidated`), and the client applies it and wipes its
 * router cache in the same step. Every action dispatched here revalidates —
 * tests/unit/social-actions-revalidate.test.ts holds that — so the refresh
 * fetched an identical tree a second time: another auth hop in middleware,
 * another full layout render, another listPieces() over the whole tenant, and
 * another copy of the message catalogue.
 *
 * It also fired from an effect outside the transition, so the buttons
 * re-enabled and the page looked settled before the second payload repainted
 * it. That was the flicker.
 */
export function useRefreshingAction(
  action: (prev: Result, formData: FormData) => Promise<Result>,
  onSuccess?: () => void,
) {
  const [state, dispatch, pending] = useActionState(action, initialResult);

  useEffect(() => {
    if (!state.ok) return;
    onSuccess?.();
    // onSuccess is a fresh closure each render; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return { state, dispatch, pending } as const;
}
