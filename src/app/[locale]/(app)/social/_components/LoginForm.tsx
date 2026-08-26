"use client";

import { useEffect, useRef, useState } from "react";
import { useId } from "react";

import type { LoginRow } from "./LoginList";
import { useTranslations } from "next-intl";


import { APP_ROLES } from "@/lib/roles";
import { isBlockedReason } from "@/lib/social";
import {
  revealSecretAction,
  saveLoginAction,
  type Result,
} from "../actions";
import { DisclosureForm } from "./DisclosureForm";
import { FieldLabel } from "./Shared";

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Roles that can plausibly be on a social login. */
const CANDIDATE_ROLES = APP_ROLES.filter(
  (r) => !["designer_identity", "developer", "accountant"].includes(r),
);

export function LoginForm({
  locale,
  clients,
  defaultClient,
  today,
  secretsReady,
  initial,
}: {
  locale: string;
  clients: { id: string; name: string }[];
  defaultClient?: string;
  today: string;
  secretsReady: boolean;
  /** Present when correcting an existing login. */
  initial?: LoginRow;
}) {
  const t = useTranslations("social.loginForm");
  const roleLabel = useTranslations("social.roleShort");
  const uid = useId();
  const editing = Boolean(initial);
  return (
    <DisclosureForm
      action={saveLoginAction}
      openLabel={editing ? t("edit") : t("open")}
      submitLabel={editing ? t("save") : t("submit")}
    >
      <input type="hidden" name="locale" value={locale} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor={`${uid}-client`}>
  {t("client")}
  </FieldLabel>
            <select
              id={`${uid}-client`}
              name="client_id"
              defaultValue={initial?.client_id ?? defaultClient}
              disabled={editing}
              className={field}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-platform`}>
  {t("account")}
  </FieldLabel>
            <input
              id={`${uid}-platform`}
              name="platform"
              defaultValue={initial?.platform ?? ""}
              className={field}
              placeholder="Instagram"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor={`${uid}-site`}>
  {t("site")}
  </FieldLabel>
            <input
              id={`${uid}-site`}
              name="site"
              defaultValue={initial?.site ?? ""}
              className={field}
              placeholder="instagram.com"
            />
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-user`}>
  {t("username")}
  </FieldLabel>
            <input
              id={`${uid}-user`}
              name="username"
              defaultValue={initial?.username ?? ""}
              className={field}
              placeholder="social@client.com"
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor={`${uid}-secret`}>
  {t("password")}
  </FieldLabel>
          <input
            id={`${uid}-secret`}
            name="secret"
            type="password"
            autoComplete="new-password"
            className={field}
            disabled={!secretsReady}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {!secretsReady
              ? t("noKeyHint")
              : editing
                ? // saveLoginAction has always treated a blank secret on an
                  // edit as "keep the stored one" — logic written for a form
                  // that did not exist. Say so, or the field reads as though
                  // leaving it empty erases the password.
                  t("passwordHintEdit")
                : t("passwordHint")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor={`${uid}-holder`}>
  {t("holder")}
  </FieldLabel>
            <input
              id={`${uid}-holder`}
              name="holder"
              defaultValue={initial?.holder ?? "client"}
              className={field}
            />
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-mfa`}>
  {t("mfa")}
  </FieldLabel>
            <input
              id={`${uid}-mfa`}
              name="mfa"
              defaultValue={initial?.mfa ?? ""}
              className={field}
              placeholder={t("mfaPlaceholder")}
            />
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-rotated`}>
  {t("rotatedOn")}
  </FieldLabel>
            <input
              id={`${uid}-rotated`}
              name="rotated_on"
              type="date"
              defaultValue={initial?.rotated_on ?? today}
              className={field}
            />
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{t("whoIsOnIt")}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CANDIDATE_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="access_roles"
                  value={r}
                  defaultChecked={initial?.access_roles?.includes(r)}
                  className="h-4 w-4 rounded border-input"
                />
                {roleLabel(r)}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <FieldLabel htmlFor={`${uid}-note`}>
  {t("note")}
  </FieldLabel>
          <textarea
            id={`${uid}-note`}
            name="note"
            defaultValue={initial?.note ?? ""}
            className={`${field} min-h-[64px]`}
            placeholder={t("notePlaceholder")}
          />
        </div>

    </DisclosureForm>
  );
}

/**
 * Show one password on request, then hide it again. It is never rendered into
 * the page's HTML — the server only hands it back when someone asks and is on
 * the login.
 */
export function RevealSecret({ id }: { id: string }) {
  const t = useTranslations("social.logins");
  const blocked = useTranslations("social.blocked");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function reveal() {
    if (secret) {
      setSecret(null);
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await revealSecretAction(id);
    setBusy(false);
    if (!res.ok || !res.secret) {
      setError(res.error ?? "notFound");
      return;
    }
    setSecret(res.secret);
    // Back to dots on its own — a revealed password left on screen is a
    // password on someone else's screen.
    timer.current = setTimeout(() => setSecret(null), 20_000);
  }

  async function copy() {
    const res = secret ? { ok: true, secret } : await revealSecretAction(id);
    if (!res.ok || !res.secret) {
      setError(res.error ?? "notFound");
      return;
    }
    try {
      await navigator.clipboard.writeText(res.secret);
      setError(null);
    } catch {
      setError("copyFailed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`font-mono text-xs ${secret ? "text-brand" : "tracking-widest"}`}
      >
        {secret ?? "•••••••••••"}
      </span>
      <button
        type="button"
        onClick={reveal}
        disabled={busy}
        className="rounded-sm text-xs text-brand hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {secret ? t("hide") : t("show")}
      </button>
      <button
        type="button"
        onClick={copy}
        className="rounded-sm text-xs text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("copy")}
      </button>
      {error ? (
        <span className="text-xs text-destructive">
          {isBlockedReason(error)
            ? blocked(error)
            : t(error === "copyFailed" ? "copyFailed" : "revealFailed")}
        </span>
      ) : null}
    </div>
  );
}
