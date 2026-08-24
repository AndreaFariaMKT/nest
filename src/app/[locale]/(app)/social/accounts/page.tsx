import { setRequestLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { secretsAvailable } from "@/lib/secrets";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";
import { AccountForm } from "../_components/AccountForm";
import { AccountList, type AccountRow } from "../_components/AccountList";
import { ModuleNote } from "../_components/Shared";

export const dynamic = "force-dynamic";

/**
 * Which account each client publishes as.
 *
 * The nav entry is coordinate-only, but nav is nav — a link that is not
 * rendered is not a permission. This screen used to be the only one in the
 * module that acted on that, with a redirect of its own; the rule now lives
 * with the screen list, so every screen is held to the capabilities it
 * declares and this one no longer has to remember.
 */
export default async function AccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("social");
  const scope = await loadScope(searchParams, "accounts");

  // loadScope("accounts") already refused anyone without `coordinate`, and the
  // middleware refused them before that. This was the only screen in the
  // module that guarded itself; now the rule lives with the screen list and
  // every screen gets it.

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  let query = supabase
    .from("client_social_accounts")
    .select(
      "id, client_id, platform, account_ref, secret_enc, api_version, publish_mode, enabled, note, rotated_on",
    )
    .eq("tenant_id", tenantId)
    .order("platform");
  if (scope.client) query = query.eq("client_id", scope.client.id);

  const { data } = await query;
  // The ciphertext never leaves the server — only whether there is one. Same
  // rule as the shared-logins screen, and for a stronger reason: this token
  // can post.
  const items: AccountRow[] = (data ?? []).map(({ secret_enc, ...row }) => ({
    ...row,
    has_secret: !!secret_enc,
  }));

  const keyReady = secretsAvailable();

  return (
    <>
      <PageHeader title={t("accounts.title")} subtitle={t("accounts.subtitle")} />
      <ModuleShell scope={scope} />

      <section className="mb-4 flex gap-3 rounded-2xl bg-destructive/5 p-5">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-destructive">
            {t("accounts.guardTitle")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("accounts.guardScope")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {keyReady ? t("accounts.guardEncrypted") : t("accounts.guardNoKey")}
          </p>
        </div>
      </section>

      <AccountForm
        locale={locale}
        clients={scope.clients.map((c) => ({ id: c.id, name: c.name }))}
        defaultClient={scope.client?.id}
        today={scope.today}
        secretsReady={keyReady}
      />

      <AccountList
        items={items}
        clientName={scope.clientName}
        locale={locale}
        secretsReady={keyReady}
      />

      <ModuleNote>{t("accounts.note")}</ModuleNote>
    </>
  );
}
