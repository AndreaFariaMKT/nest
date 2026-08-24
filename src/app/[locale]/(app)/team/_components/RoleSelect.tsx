"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";

import { APP_ROLES, type AppRole } from "@/lib/roles";
import { setMemberRoleAction, type MemberRoleState } from "../actions";

const initial: MemberRoleState = {};

/**
 * A member's role, changeable in place.
 *
 * Submits on change rather than behind a save button: there is one field, and
 * a select that silently keeps a value you did not commit is worse than a
 * round trip.
 */
export function RoleSelect({
  userId,
  role,
  locale,
  disabled,
}: {
  userId: string;
  role: AppRole;
  locale: string;
  /** The founder's own row — see the page for why it does not change here. */
  disabled?: boolean;
}) {
  const t = useTranslations("team");
  const [state, action, pending] = useActionState(setMemberRoleAction, initial);
  const id = useId();

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor={id} className="sr-only">
        {t("fields.role")}
      </label>
      <select
        id={id}
        name="role"
        defaultValue={role}
        disabled={pending || disabled}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      >
        {APP_ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`appRoles.${r}`)}
          </option>
        ))}
      </select>
      {state.error ? (
        <span role="alert" className="text-xs text-destructive">
          {t(`errors.${state.error}`)}
        </span>
      ) : null}
      {state.ok ? (
        <span role="status" className="text-xs text-muted-foreground">
          {t("roleSaved")}
        </span>
      ) : null}
    </form>
  );
}
