"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  isBlockedReason,
  type DesignState,
  type SocialAction,
} from "@/lib/social";
import {
  buildOrderAction,
  releaseSignedOffAction,
  runTransitionAction,
  setDesignStateAction,
  type Result,
} from "../actions";

const initial: Result = { ok: false };

/**
 * The module speaks in three moves — the one you probably want, the neutral
 * one, and the one that sends something back. They map onto the shared Button
 * so every one of them carries the focus ring the rest of the app has.
 */
type Variant = "primary" | "secondary" | "danger";

const VARIANT: Record<Variant, "brand" | "secondary" | "danger"> = {
  primary: "brand",
  secondary: "secondary",
  danger: "danger",
};

function Btn({
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
  // Anything not in the dictionary came from Postgres — show it verbatim
  // rather than swallowing a real failure behind a friendly noise word.
  return (
    <p className="mt-2 text-xs text-destructive">
      {isBlockedReason(error) ? t(error) : error}
    </p>
  );
}

export interface Choice {
  action: SocialAction;
  label: string;
  variant?: Variant;
}

/**
 * One form, several outcomes. The comment box is shared: "approve with changes"
 * and "not approved" both need a reason, and asking for it in the same place
 * the decision is made is what keeps a round-trip from becoming three.
 */
export function DecisionForm({
  id,
  locale,
  choices,
  commentLabel,
  commentHint,
  commentPlaceholder,
  defaultComment,
  extra,
}: {
  id: string;
  locale: string;
  choices: Choice[];
  commentLabel?: string;
  commentHint?: string;
  commentPlaceholder?: string;
  defaultComment?: string;
  /** Extra hidden fields, e.g. a publish date when pulling a theme. */
  extra?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(runTransitionAction, initial);
  const router = useRouter();
  // One of these renders per piece on a page that maps over many, so a static
  // id would bind every label to the first textarea.
  const commentId = useId();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      {extra}
      {commentLabel ? (
        <div className="mb-3">
          <label
            htmlFor={commentId}
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {commentLabel}
          </label>
          <textarea
            id={commentId}
            name="comment"
            defaultValue={defaultComment}
            placeholder={commentPlaceholder}
            className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {commentHint ? (
            <p className="mt-1 text-xs text-muted-foreground">{commentHint}</p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <Btn
            key={c.action}
            name="action"
            value={c.action}
            variant={c.variant}
            disabled={pending}
          >
            {c.label}
          </Btn>
        ))}
      </div>
      <Refusal error={state.error} />
    </form>
  );
}

/** A single move with nothing to say about it. */
export function QuickAction({
  id,
  locale,
  action: name,
  label,
  variant = "secondary",
  className,
}: {
  id: string;
  locale: string;
  action: SocialAction;
  label: string;
  variant?: Variant;
  className?: string;
}) {
  const [state, act, pending] = useActionState(runTransitionAction, initial);
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={act} className={className}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="action" value={name} />
      <Btn variant={variant} disabled={pending}>
        {label}
      </Btn>
      <Refusal error={state.error} />
    </form>
  );
}

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
  const [state, act, pending] = useActionState(setDesignStateAction, initial);
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={act}>
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

/** Send every signed-off piece to its own client. */
export function ReleaseAllButton({
  locale,
  clientId,
  label,
}: {
  locale: string;
  clientId?: string;
  label: string;
}) {
  const [state, act, pending] = useActionState(releaseSignedOffAction, initial);
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={act}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="client_id" value={clientId ?? ""} />
      <Btn variant="primary" disabled={pending}>
        {label}
      </Btn>
      <Refusal error={state.error} />
    </form>
  );
}

/** Approved pieces become one ordered list for whoever posts. */
export function BuildOrderButton({
  locale,
  clientId,
  label,
}: {
  locale: string;
  clientId?: string;
  label: string;
}) {
  const [state, act, pending] = useActionState(buildOrderAction, initial);
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={act}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="client_id" value={clientId ?? ""} />
      <Btn variant="primary" disabled={pending}>
        {label}
      </Btn>
      <Refusal error={state.error} />
    </form>
  );
}
