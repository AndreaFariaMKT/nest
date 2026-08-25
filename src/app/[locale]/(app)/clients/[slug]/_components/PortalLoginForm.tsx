"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  invitePortalLoginAction,
  type PortalLoginState,
} from "../../actions";

const initial: PortalLoginState = {};

/**
 * Invites the client to their own portal.
 *
 * Until now there was no way to do this at all: `clients.portal_user_id` had
 * no write site anywhere, so the authenticated portal — ten screens, the whole
 * client navigation — could not be reached by any real client, and the shared
 * bearer link was the only thing that worked.
 */
export function PortalLoginForm({
  clientId,
  slug,
  locale,
  linkedEmail,
}: {
  clientId: string;
  slug: string;
  locale: string;
  /** Set once somebody is linked, so the form becomes a statement of fact. */
  linkedEmail?: string | null;
}) {
  const t = useTranslations("clients");
  const [state, action, pending] = useActionState(
    invitePortalLoginAction,
    initial,
  );

  if (linkedEmail) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("portalLogin.linked", { email: linkedEmail })}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="locale" value={locale} />
      <Label htmlFor="portal-email">{t("portalLogin.label")}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="portal-email"
          name="email"
          type="email"
          required
          placeholder="contato@cliente.com"
          className="min-w-[200px] flex-1"
        />
        <Button type="submit" disabled={pending} className="h-10">
          {t("portalLogin.invite")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("portalLogin.hint")}</p>
      {state.error ? (
        <p role="alert" className="text-xs text-destructive">
          {t(`portalLogin.errors.${state.error}`)}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">
          {t("portalLogin.sent", { email: state.success })}
        </p>
      ) : null}
    </form>
  );
}
