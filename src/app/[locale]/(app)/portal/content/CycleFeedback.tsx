"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Refusal } from "../../social/_components/ActionPrimitives";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { sendMessageAction, type SendState } from "../../messages/actions";

const initial: SendState = { ok: false };

/**
 * The two questions that close a cycle.
 *
 * They land in the client's room as a message rather than in a table of their
 * own, because that room is already where coordination reads this client — a
 * second inbox is an inbox nobody checks. The answers feed the next fortnight's
 * themes, which is what keeps the backlog stocked.
 */
export function CycleFeedback({
  locale,
  clientId,
}: {
  locale: string;
  clientId: string;
}) {
  const t = useTranslations("social.portal.feedback");
  const [state, action, pending] = useActionState(sendMessageAction, initial);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  // Both answers travel as one message so coordination reads them together.
  function compose(formData: FormData) {
    const themes = (formData.get("themes") ?? "").toString().trim();
    const cycle = (formData.get("cycle") ?? "").toString().trim();
    const parts: string[] = [];
    if (themes) parts.push(`${t("themes")}\n${themes}`);
    if (cycle) parts.push(`${t("cycle")}\n${cycle}`);
    formData.set("body", parts.join("\n\n"));
    return action(formData);
  }

  // With both boxes empty the composed body is empty, and sendMessageAction
  // returns { ok: false } with no error: the client pressed Send and
  // absolutely nothing happened — no message, no complaint, no reset. Disabled
  // is the honest state.
  const [empty, setEmpty] = useState(true);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {t("title")}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">{t("hint")}</p>

      <form
        ref={form}
        action={compose}
        onInput={() => {
          const el = form.current;
          if (!el) return;
          const data = new FormData(el);
          setEmpty(
            !(data.get("themes") ?? "").toString().trim() &&
              !(data.get("cycle") ?? "").toString().trim(),
          );
        }}
        className="space-y-4"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="room" value="client" />

        <div className="space-y-1.5">
          <Label htmlFor="feedback-themes">{t("themes")}</Label>
          <Textarea id="feedback-themes" name="themes" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="feedback-cycle">{t("cycle")}</Label>
          <Textarea id="feedback-cycle" name="cycle" />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending || empty}>
            {t("send")}
          </Button>
          {state.ok && !pending ? (
            <span role="status" className="text-xs text-emerald-600">
              {t("sent")}
            </span>
          ) : null}
          {/* Was rendering the raw key — a client saw the literal string
              "unauthorized" or "dbFailed" in the middle of a Portuguese page.
              Refusal is the component that turns those into sentences. */}
          <Refusal error={state.error} />
        </div>
      </form>
    </section>
  );
}
