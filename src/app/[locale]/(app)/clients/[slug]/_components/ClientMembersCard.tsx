"use client";

import { FormError } from "@/components/ui/FormError";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  attachClientMemberAction,
  detachClientMemberAction,
} from "../members-actions";

export type AssignedMember = {
  userId: string;
  label: string;
  email: string;
};

export type MemberChoice = {
  id: string;
  label: string;
};

export function ClientMembersCard({
  locale,
  clientId,
  clientSlug,
  members,
  candidates,
}: {
  locale: string;
  clientId: string;
  clientSlug: string;
  members: AssignedMember[];
  candidates: MemberChoice[];
}) {
  const t = useTranslations("clients");
  const [isPending, startTransition] = useTransition();
  // Both writes used to discard their error, so a refusal looked exactly
  // like a success: the row just never appeared.
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(members.map((m) => m.userId));
  const available = candidates.filter((c) => !assignedIds.has(c.id));

  function onAttach(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    fd.set("clientId", clientId);
    fd.set("clientSlug", clientSlug);
    fd.set("locale", locale);
    (event.currentTarget as HTMLFormElement).reset();
    startTransition(async () => {
      const result = await attachClientMemberAction(fd);
      setError(result.ok ? null : (result.error ?? "dbFailed"));
    });
  }

  function onDetach(userId: string) {
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("clientSlug", clientSlug);
    fd.set("userId", userId);
    fd.set("locale", locale);
    startTransition(async () => {
      const result = await detachClientMemberAction(fd);
      setError(result.ok ? null : (result.error ?? "dbFailed"));
    });
  }

  return (
    <div className="space-y-3">
      <FormError error={error} />
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("sections.membersEmpty")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
              data-testid="client-member-row"
            >
              <div className="flex flex-col">
                <span className="font-medium">{member.label}</span>
                <span className="text-xs text-muted-foreground">
                  {member.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onDetach(member.userId)}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                aria-label={t("actions.detachMember")}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <form
          onSubmit={onAttach}
          className="flex items-center gap-2"
          data-testid="attach-member-form"
        >
          <select
            name="userId"
            required
            defaultValue=""
            className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              {t("actions.pickMember")}
            </option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {t("actions.attachMember")}
          </button>
        </form>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("actions.noStaff")}</p>
      ) : null}
    </div>
  );
}
