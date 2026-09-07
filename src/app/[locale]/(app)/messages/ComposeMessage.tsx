"use client";

import { useActionState, useEffect, useRef } from "react";

import { sendMessageAction, type SendState } from "./actions";
import { EmojiPicker } from "./EmojiPicker";
import { Refusal } from "../social/_components/ActionPrimitives";

const initial: SendState = { ok: false };

export function ComposeMessage({
  locale,
  placeholder,
  sendLabel,
  clientId,
  room,
  emojiLabel,
}: {
  locale: string;
  placeholder: string;
  sendLabel: string;
  emojiLabel: string;
  clientId?: string;
  /** "team" keeps the message inside the studio; "client" is readable by them. */
  room?: "team" | "client";
}) {
  const [state, action, pending] = useActionState(sendMessageAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Insert at the caret, not at the end. Appending is the one-line version and
   * it is wrong the moment someone goes back to add an emoji mid-sentence —
   * the character lands after the last word instead of where they put the
   * cursor. The field stays uncontrolled so `form.reset()` above keeps working.
   */
  function insertEmoji(emoji: string) {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + emoji + input.value.slice(end);

    // Put the caret after what was just inserted, then hand focus back so the
    // next thing typed continues the sentence rather than going nowhere.
    const caret = start + emoji.length;
    input.setSelectionRange(caret, caret);
    input.focus();
  }

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    // No refresh. sendMessageAction revalidates both message routes, so the
    // action's own response already carries the re-rendered list for whichever
    // one you are on — the refresh fetched an identical tree a second time.
    // With the live subscription now mounted, it would have been a third.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="client_id" value={clientId ?? ""} />
      <input type="hidden" name="room" value={room ?? "client"} />
      <input
        ref={inputRef}
        name="body"
        autoComplete="off"
        placeholder={placeholder}
        className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand"
      />
      <EmojiPicker onPick={insertEmoji} label={emojiLabel} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
      >
        {sendLabel}
      </button>
      </div>
      {/* A send that failed cleared nothing and said nothing: the message
          stayed in the box and the only reading was that the click missed. */}
      <Refusal error={state.error} />
    </form>
  );
}
