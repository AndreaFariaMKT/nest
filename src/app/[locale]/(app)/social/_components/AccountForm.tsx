"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { saveSocialAccountAction } from "../actions";
import { Refusal, useRefreshingAction } from "./ActionPrimitives";
import { DisclosureForm } from "./DisclosureForm";
import { FieldLabel } from "./Shared";

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const PLATFORMS = ["instagram", "linkedin", "tiktok"] as const;

export interface AccountDefaults {
  id: string;
  client_id: string;
  platform: string;
  account_ref: string | null;
  api_version: string | null;
  publish_mode: string;
  enabled: boolean;
  note: string | null;
  rotated_on: string | null;
}

export function AccountForm({
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
  const t = useTranslations("social.accountForm");
  // The reference field means a different thing per network and is meaningless
  // on one of them, so the form follows the choice rather than showing three
  // boxes and hoping.
  const [platform, setPlatform] = useState<string>("instagram");
  const needsRef = platform !== "tiktok";

  return (
    <DisclosureForm
      action={saveSocialAccountAction}
      openLabel={t("open")}
      submitLabel={t("submit")}
    >
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="account-client">{t("client")}</FieldLabel>
          <select
            id="account-client"
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
          <FieldLabel htmlFor="account-platform">{t("platform")}</FieldLabel>
          <select
            id="account-platform"
            name="platform"
            className={field}
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {t(`platforms.${p}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {needsRef ? (
        <div>
          <FieldLabel htmlFor="account-ref">
            {platform === "linkedin" ? t("refLinkedIn") : t("refInstagram")}
          </FieldLabel>
          <input
            id="account-ref"
            name="account_ref"
            className={field}
            placeholder={
              platform === "linkedin"
                ? "urn:li:organization:12345678"
                : "17841400000000000"
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {platform === "linkedin" ? t("refLinkedInHint") : t("refInstagramHint")}
          </p>
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor="account-secret">{t("token")}</FieldLabel>
        <input
          id="account-secret"
          name="secret"
          type="password"
          autoComplete="new-password"
          className={field}
          disabled={!secretsReady}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {secretsReady ? t("tokenHint") : t("tokenNoKey")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="account-api">{t("apiVersion")}</FieldLabel>
          <input
            id="account-api"
            name="api_version"
            className={field}
            placeholder={platform === "linkedin" ? "202410" : "v21.0"}
          />
        </div>
        <div>
          <FieldLabel htmlFor="account-rotated">{t("rotatedOn")}</FieldLabel>
          <input
            id="account-rotated"
            name="rotated_on"
            type="date"
            defaultValue={today}
            className={field}
          />
        </div>
      </div>

      {platform === "tiktok" ? (
        <div>
          <FieldLabel htmlFor="account-mode">{t("publishMode")}</FieldLabel>
          <select
            id="account-mode"
            name="publish_mode"
            className={field}
            defaultValue="inbox"
          >
            <option value="inbox">{t("modes.inbox")}</option>
            <option value="direct">{t("modes.direct")}</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("publishModeHint")}
          </p>
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor="account-note">{t("note")}</FieldLabel>
        <input id="account-note" name="note" className={field} />
      </div>

      {/* Separate from having a token on purpose: registering an account and
          authorising it to post are two decisions, and a half-finished
          onboarding must not put anything on a live feed. */}
      <label className="flex items-start gap-2.5 rounded-md bg-muted/40 p-3">
        <input
          type="checkbox"
          name="enabled"
          className="mt-0.5 h-4 w-4 rounded border-input"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            {t("enabled")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t("enabledHint")}
          </span>
        </span>
      </label>
    </DisclosureForm>
  );
}

/**
 * Editing an account that already exists.
 *
 * The server action always had a complete update branch; nothing ever sent it
 * an `id`, so every submit inserted — and `unique (client_id, platform)` then
 * refused it as a duplicate. The practical effect was that rotating a token or
 * switching an account OFF required deleting the row, which stops publishing
 * mid-flight and loses the note and the audit trail. Both locales had already
 * been promising this ("Ao editar, deixe em branco para manter o token atual").
 *
 * Client and network are not editable: together they are the row's identity,
 * and repointing a stored token at a different network is the one mistake this
 * table exists to prevent. Changing either means a new account.
 */
export function AccountEditForm({
  locale,
  account,
  clientName,
  secretsReady,
}: {
  locale: string;
  account: AccountDefaults;
  clientName: string;
  secretsReady: boolean;
}) {
  const t = useTranslations("social.accountForm");
  const needsRef = account.platform !== "tiktok";
  const { state, dispatch, pending } = useRefreshingAction(
    saveSocialAccountAction,
  );

  return (
    <form action={dispatch} className="space-y-4 border-t border-border p-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={account.id} />
      <input type="hidden" name="client_id" value={account.client_id} />
      <input type="hidden" name="platform" value={account.platform} />

      <p className="text-xs text-muted-foreground">
        {clientName} · {t(`platforms.${account.platform}`)}
      </p>

      {needsRef ? (
        <div>
          <FieldLabel htmlFor={`edit-ref-${account.id}`}>
            {account.platform === "linkedin" ? t("refLinkedIn") : t("refInstagram")}
          </FieldLabel>
          <input
            id={`edit-ref-${account.id}`}
            name="account_ref"
            className={field}
            defaultValue={account.account_ref ?? ""}
          />
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor={`edit-secret-${account.id}`}>{t("token")}</FieldLabel>
        <input
          id={`edit-secret-${account.id}`}
          name="secret"
          type="password"
          autoComplete="new-password"
          className={field}
          disabled={!secretsReady}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {secretsReady ? t("tokenHint") : t("tokenNoKey")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`edit-api-${account.id}`}>{t("apiVersion")}</FieldLabel>
          <input
            id={`edit-api-${account.id}`}
            name="api_version"
            className={field}
            defaultValue={account.api_version ?? ""}
          />
        </div>
        <div>
          <FieldLabel htmlFor={`edit-rot-${account.id}`}>{t("rotatedOn")}</FieldLabel>
          <input
            id={`edit-rot-${account.id}`}
            name="rotated_on"
            type="date"
            className={field}
            defaultValue={account.rotated_on ?? ""}
          />
        </div>
      </div>

      {account.platform === "tiktok" ? (
        <div>
          <FieldLabel htmlFor={`edit-mode-${account.id}`}>{t("publishMode")}</FieldLabel>
          <select
            id={`edit-mode-${account.id}`}
            name="publish_mode"
            className={field}
            defaultValue={account.publish_mode}
          >
            <option value="inbox">{t("modes.inbox")}</option>
            <option value="direct">{t("modes.direct")}</option>
          </select>
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor={`edit-note-${account.id}`}>{t("note")}</FieldLabel>
        <input
          id={`edit-note-${account.id}`}
          name="note"
          className={field}
          defaultValue={account.note ?? ""}
        />
      </div>

      <label className="flex items-start gap-2.5 rounded-md bg-muted/40 p-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={account.enabled}
          className="mt-0.5 h-4 w-4 rounded border-input"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            {t("enabled")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t("enabledHint")}
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="brand" disabled={pending}>
          {t("save")}
        </Button>
        <Refusal error={state.error} />
      </div>
    </form>
  );
}
