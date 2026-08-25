import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "@/i18n/routing";
import type { Route } from "next";
import { formatCentsAsBrl, sumCents } from "@/lib/money";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  monthly_value_cents: number | null;
  starts_on: string;
  ends_on: string | null;
  auto_renew: boolean;
  client_id: string;
};

export default async function FinancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("finance");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: contractsData }, { data: clientsData }] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id, title, monthly_value_cents, starts_on, ends_on, auto_renew, client_id",
      )
      .eq("tenant_id", tenantId)
      .order("starts_on", { ascending: false }),
    supabase.from("clients").select("id, name, slug").eq("tenant_id", tenantId),
  ]);

  const contracts = (contractsData ?? []) as Row[];
  const clientOf = new Map(
    (clientsData ?? []).map((c) => [c.id, { name: c.name, slug: c.slug }]),
  );

  const isActive = (c: Row) =>
    c.starts_on <= today && (c.ends_on === null || c.ends_on >= today);
  const active = contracts.filter(isActive);
  const mrr = sumCents(active.map((c) => c.monthly_value_cents));
  const onRetainer = new Set(active.map((c) => c.client_id)).size;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const fmtDate = (d: string | null) => (d ? dateFmt.format(new Date(d)) : "—");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label={t("mrr")} value={formatCentsAsBrl(mrr)} />
        <Stat label={t("activeContracts")} value={String(active.length)} />
        <Stat label={t("onRetainer")} value={String(onRetainer)} />
      </section>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>{t("th.client")}</Th>
              <Th>{t("th.contract")}</Th>
              <Th>{t("th.period")}</Th>
              <Th className="text-right">{t("th.monthly")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contracts.map((c) => (
              <tr key={c.id} className={isActive(c) ? "" : "opacity-55"}>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {/* The contract row named its client and stopped there, so
                      chasing anything on this screen meant going back to the
                      client list and searching. */}
                  {clientOf.has(c.client_id) ? (
                    <Link
                      href={`/clients/${clientOf.get(c.client_id)!.slug}` as Route}
                      className="hover:text-brand hover:underline"
                    >
                      {clientOf.get(c.client_id)!.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {c.title}
                  {c.auto_renew ? (
                    <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] text-brand-soft-foreground">
                      {t("autoRenew")}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {fmtDate(c.starts_on)} → {fmtDate(c.ends_on)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-foreground">
                  {formatCentsAsBrl(c.monthly_value_cents ?? 0)}
                </td>
              </tr>
            ))}
            {contracts.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 font-display text-3xl leading-none text-foreground">
        {value}
      </div>
    </div>
  );
}
