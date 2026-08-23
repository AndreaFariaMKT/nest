"use client";

import { useEffect, useRef, useState } from "react";
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
}: {
  locale: string;
  clients: { id: string; name: string }[];
  defaultClient?: string;
  today: string;
  secretsReady: boolean;
}) {
  const t = useTranslations("social.loginForm");
  const roleLabel = useTranslations("social.roleShort");
  return (
    <DisclosureForm
      action={saveLoginAction}
      openLabel={t("open")}
      submitLabel={t("submit")}
    >
      <input type="hidden" name="locale" value={locale} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="login-client">
  {t("client")}
  </FieldLabel>
            <select
              id="login-client"
              name="client_id"
              defaultValue={defaultClient}
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
            <FieldLabel htmlFor="login-platform">
  {t("account")}
  </FieldLabel>
            <input
              id="login-platform"
              name="platform"
              className={field}
              placeholder="Instagram"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="login-site">
  {t("site")}
  </FieldLabel>
            <input
              id="login-site"
              name="site"
              className={field}
              placeholder="instagram.com"
            />
          </div>
          <div>
            <FieldLabel htmlFor="login-user">
  {t("username")}
  </FieldLabel>
            <input
              id="login-user"
              name="username"
              className={field}
              placeholder="social@client.com"
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="login-secret">
  {t("password")}
  </FieldLabel>
          <input
            id="login-secret"
            name="secret"
            type="password"
            autoComplete="new-password"
            className={field}
            disabled={!secretsReady}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {secretsReady ? t("passwordHint") : t("noKeyHint")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="login-holder">
  {t("holder")}
  </FieldLabel>
            <input
              id="login-holder"
              name="holder"
              defaultValue="client"
              className={field}
            />
          </div>
          <div>
            <FieldLabel htmlFor="login-mfa">
  {t("mfa")}
  </FieldLabel>
            <input
              id="login-mfa"
              name="mfa"
              className={field}
              placeholder={t("mfaPlaceholder")}
            />
          </div>
          <div>
            <FieldLabel htmlFor="login-rotated">
  {t("rotatedOn")}
  </FieldLabel>
            <input
              id="login-rotated"
              name="rotated_on"
              type="date"
              defaultValue={today}
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
                  className="h-4 w-4 rounded border-input"
                />
                {roleLabel(r)}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <FieldLabel htmlFor="login-note">
  {t("note")}
  </FieldLabel>
          <textarea
            id="login-note"
            name="note"
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
