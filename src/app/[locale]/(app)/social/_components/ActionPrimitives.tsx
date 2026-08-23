"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { isBlockedReason } from "@/lib/social";
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

/** Renders a refusal as a sentence. `error` is an i18n key, or a raw DB message. */
export function Refusal({ error }: { error?: string }) {
  const t = useTranslations("social.blocked");
  if (!error) return null;
  // Anything not in the dictionary came from Postgres — show it verbatim rather
  // than swallowing a real failure behind a friendly noise word.
  return (
    <p className="mt-2 text-xs text-destructive">
      {isBlockedReason(error) ? t(error) : error}
    </p>
  );
}

/**
 * Every form in the module does the same three things: run a server action,
 * refresh the route when it succeeds, and show the refusal when it does not.
 * This was written out nine times before it was a hook.
 */
export function useRefreshingAction(
  action: (prev: Result, formData: FormData) => Promise<Result>,
  onSuccess?: () => void,
) {
  const [state, dispatch, pending] = useActionState(action, initialResult);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    onSuccess?.();
    router.refresh();
    // onSuccess is a fresh closure each render; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  return { state, dispatch, pending } as const;
}
