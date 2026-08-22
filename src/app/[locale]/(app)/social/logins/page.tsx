import { setRequestLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { secretsAvailable } from "@/lib/secrets";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";
import { LoginForm } from "../_components/LoginForm";
import { LoginList, type LoginRow } from "../_components/LoginList";

export const dynamic = "force-dynamic";

export default async function LoginsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("social");
  const scope = await loadScope(searchParams);

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  let query = supabase
    .from("shared_logins")
    .select(
      "id, client_id, platform, site, username, secret_enc, holder, mfa, access_roles, note, rotated_on",
    )
    .eq("tenant_id", tenantId)
    .order("platform");
  if (scope.client) query = query.eq("client_id", scope.client.id);

  const { data } = await query;
  // The ciphertext never reaches the browser — only whether there is one.
  const items: LoginRow[] = (data ?? []).map(({ secret_enc, ...row }) => ({
    ...row,
    has_secret: !!secret_enc,
  }));

  const canEdit = scope.caps.includes("coordinate");
  const keyReady = secretsAvailable();

  return (
    <>
      <PageHeader title={t("logins.title")} subtitle={t("logins.subtitle")} />
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
            {t("logins.guardTitle")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("logins.guardScope")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("logins.guardPartner")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {keyReady ? t("logins.guardEncrypted") : t("logins.guardNoKey")}
          </p>
        </div>
      </section>

      {canEdit ? (
        <LoginForm
          locale={locale}
          clients={scope.clients.map((c) => ({ id: c.id, name: c.name }))}
          defaultClient={scope.client?.id}
          today={scope.today}
          secretsReady={keyReady}
        />
      ) : null}

      <LoginList
        items={items}
        clientName={(id) => scope.clients.find((c) => c.id === id)?.name ?? "—"}
        locale={locale}
        today={scope.today}
        canEdit={canEdit}
      />

      <p className="mt-4 rounded-xl border-l-2 border-brand bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {t("logins.note")}
      </p>
    </>
  );
}
