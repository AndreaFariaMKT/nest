import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { isOwner } from "@/lib/auth";
import { formatCentsAsBrl, sumCents } from "@/lib/money";
import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Contract = Database["public"]["Tables"]["contracts"]["Row"];

export default async function ClientContractsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // Non-owners never see this page, even though RLS would also hide rows.
  if (!(await isOwner())) notFound();

  const t = await getTranslations("contracts");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const { data: clientData } = await supabase
    .from("clients")
    .select("id, slug, name")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();
  if (!clientData) notFound();
  const client = clientData as Pick<Client, "id" | "slug" | "name">;

  const { data: contractData } = await supabase
    .from("contracts")
    .select("*")
    .eq("client_id", client.id)
    .order("starts_on", { ascending: false });
  const contracts = (contractData ?? []) as Contract[];

  const today = new Date().toISOString().slice(0, 10);
  const mrr = sumCents(
    contracts
      .filter((c) => c.starts_on <= today && (!c.ends_on || c.ends_on >= today))
      .map((c) => c.monthly_value_cents),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/clients/${client.slug}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {client.name}
          </Link>
          <h1 className="mt-2 font-display text-4xl text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitle", { mrr: formatCentsAsBrl(mrr) })}
          </p>
        </div>
        <Link
          href={`/clients/${client.slug}/contracts/new`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("new")}
        </Link>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => (
            <Link
              key={contract.id}
              href={`/clients/${client.slug}/contracts/${contract.id}/edit`}
              className="block rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg">{contract.title}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                      new Date(contract.starts_on),
                    )}
                    {contract.ends_on
                      ? ` — ${new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(new Date(contract.ends_on))}`
                      : contract.auto_renew
                        ? ` · ${t("autoRenewBadge")}`
                        : ""}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg">
                    {formatCentsAsBrl(contract.monthly_value_cents)}
                  </div>
                  {contract.auto_renew ? (
                    <Pill tone="success" className="mt-1">
                      {t("autoRenewBadge")}
                    </Pill>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
