"use client";

import { useActionState } from "react";

import { savePieceAction, type Result } from "../actions";
import { Refusal } from "./ActionPrimitives";

const initial: Result = { ok: false };

/**
 * Field edits that do not move a piece. The server decides which of the posted
 * fields it will actually accept for this role, so a panel can render what its
 * reader owns without re-implementing the permission table.
 */
export function SaveFields({
  id,
  locale,
  submitLabel,
  savedLabel,
  children,
}: {
  id: string;
  locale: string;
  submitLabel: string;
  savedLabel: string;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(savePieceAction, initial);

  // No refresh — savePieceAction revalidates. See Moves.tsx. The empty effect
  // that used to hold this comment ran on every state change and did nothing.

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      {children}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {submitLabel}
        </button>
        {state.ok && !pending ? (
          <span role="status" className="text-xs text-emerald-600">
            {savedLabel}
          </span>
        ) : null}
        <Refusal error={state.error} />
      </div>
    </form>
  );
}
