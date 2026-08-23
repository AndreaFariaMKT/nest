"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import type { Result } from "../actions";
import { Refusal, useRefreshingAction } from "./ActionPrimitives";

/**
 * The "+ Add a…" panel the module opens three times: a theme, a media item, a
 * shared login. Same disclosure, same reset-and-close on success, same submit
 * row — written out three times before it was a component.
 *
 * `<details>` carries its accessible name from the `<summary>` text, so the
 * disclosure is reachable and announced without extra ARIA.
 */
export function DisclosureForm({
  action,
  openLabel,
  submitLabel,
  children,
}: {
  action: (prev: Result, formData: FormData) => Promise<Result>;
  openLabel: string;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const details = useRef<HTMLDetailsElement>(null);

  const { state, dispatch, pending } = useRefreshingAction(action);

  useEffect(() => {
    if (!state.ok) return;
    form.current?.reset();
    if (details.current) details.current.open = false;
  }, [state]);

  return (
    <details
      ref={details}
      className="mb-4 rounded-2xl border border-border bg-card [&[open]>summary]:border-b"
    >
      <summary className="cursor-pointer list-none rounded-t-2xl border-border px-5 py-3.5 text-sm font-medium text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        + {openLabel}
      </summary>

      <form
        ref={form}
        action={dispatch}
        className="space-y-4 p-5"
        data-testid="disclosure-form"
      >
        {children}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="brand" disabled={pending}>
            {submitLabel}
          </Button>
          <Refusal error={state.error} />
        </div>
      </form>
    </details>
  );
}
