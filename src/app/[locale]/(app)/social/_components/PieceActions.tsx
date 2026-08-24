"use client";

import { useState } from "react";
import type { DesignState } from "@/lib/social";
import {
  buildOrderAction,
  releaseSignedOffAction,
  setDesignStateAction,
} from "../actions";
import { Btn, Refusal, useRefreshingAction } from "./ActionPrimitives";

/**
 * The controls that act on more than one piece, or on something other than a
 * piece's stage. Per-piece moves live in Moves.tsx, derived from the domain
 * rather than branched per screen.
 */

/** Design's own progress: to do → done → signed off. */
export function DesignStateForm({
  id,
  locale,
  current,
  options,
}: {
  id: string;
  locale: string;
  current: DesignState;
  options: { value: DesignState; label: string }[];
}) {
  const { state, dispatch, pending } = useRefreshingAction(setDesignStateAction);

  return (
    <form action={dispatch}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Btn
            key={o.value}
            name="design_state"
            value={o.value}
            variant={o.value === current ? "primary" : "secondary"}
            disabled={pending}
          >
            {o.label}
          </Btn>
        ))}
      </div>
      <Refusal error={state.error} />
    </form>
  );
}

/**
 * One button, one batch. Both moves are "take everything in this stage and put
 * it in the next one", so they differ only in which action they call.
 *
 * Both arm before they fire, which the module got backwards: deleting one
 * media row asked for a second click, while sending every signed-off piece to
 * every client — outbound to customers, and not undoable anywhere in the
 * module — went on the first. Same two-click pattern as ConfirmDeleteButton,
 * so the gesture is the one people already know.
 */
function BatchButton({
  action,
  locale,
  clientId,
  label,
  confirmLabel,
}: {
  action: typeof releaseSignedOffAction;
  locale: string;
  clientId?: string;
  label: string;
  confirmLabel: string;
}) {
  const [armed, setArmed] = useState(false);
  const { state, dispatch, pending } = useRefreshingAction(action, () =>
    setArmed(false),
  );

  return (
    <form action={dispatch}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="client_id" value={clientId ?? ""} />
      <Btn
        variant="primary"
        disabled={pending}
        aria-live="polite"
        // Unarmed the button must not submit; arming is the whole point.
        type={armed ? "submit" : "button"}
        onClick={armed ? undefined : () => setArmed(true)}
        onBlur={() => setArmed(false)}
      >
        {armed ? confirmLabel : label}
      </Btn>
      <Refusal error={state.error} />
    </form>
  );
}

/** Send every signed-off piece to its own client — each one alone. */
export function ReleaseAllButton(props: {
  locale: string;
  clientId?: string;
  label: string;
  confirmLabel: string;
}) {
  return <BatchButton action={releaseSignedOffAction} {...props} />;
}

/** Approved pieces become one ordered list for whoever posts. */
export function BuildOrderButton(props: {
  locale: string;
  clientId?: string;
  label: string;
  confirmLabel: string;
}) {
  return <BatchButton action={buildOrderAction} {...props} />;
}
