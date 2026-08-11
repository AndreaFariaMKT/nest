"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { sendMessageAction, type SendState } from "./actions";

const initial: SendState = { ok: false };

export function ComposeMessage({
  locale,
  placeholder,
  sendLabel,
}: {
  locale: string;
  placeholder: string;
  sendLabel: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(sendMessageAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input
        name="body"
        autoComplete="off"
        placeholder={placeholder}
        className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
      >
        {sendLabel}
      </button>
    </form>
  );
}
