import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { CompanyDocuments, type CompanyDoc } from "./CompanyDocuments";
import { EXPIRY_ORDER, expiryOf } from "@/lib/company-documents";
import { STUDIO_TIMEZONE, todayIso } from "@/lib/social";
import type { CompanyDocumentRow } from "@/types/database";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

export const dynamic = "force-dynamic";

export default async function AdministrationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("administration");
  const supabase = await createClient();
  const tenantId = await currentTenantId();
  // See administration/actions.ts — `company_documents` arrives with migration
  // 046 and the generated types do not know it until `types:gen` runs. One
  // cast, the same one, on the read side.
  const fromDocs = (
    supabase as unknown as {
      from(t: string): {
        select(c: string): {
          eq(
            col: string,
            v: string,
          ): {
            order(
              c: string,
              o: { ascending: boolean; nullsFirst?: boolean },
            ): { limit(n: number): Promise<{ data: CompanyDocumentRow[] | null }> };
          };
        };
      };
    }
  ).from("company_documents");

  const [{ data: contracts }, { data: clients }, { data: companyDocs }] =
    await Promise.all([
    supabase.from("contracts").select("id, title, document_url, client_id, starts_on").eq("tenant_id", tenantId).not("document_url", "is", null).order("starts_on", { ascending: false })
    .limit(OPTION_LIST_CAP),
    supabase.from("clients").select("id, name, slug").eq("tenant_id", tenantId),
    fromDocs
      .select("id, title, category, document_url, notes, valid_until")
      .eq("tenant_id", tenantId)
      .order("valid_until", { ascending: true, nullsFirst: false })
      .limit(OPTION_LIST_CAP),
  ]);

  const today = todayIso();
  const dayFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: STUDIO_TIMEZONE,
  });

  // Ordered by the domain, not by name: this screen is opened to answer "is
  // anything about to lapse", so the answer is the top of the list.
  const docs: CompanyDoc[] = ((companyDocs ?? []) as CompanyDocumentRow[])
    .map((d) => {
      const expiry = expiryOf(d.valid_until, today);
      return {
        id: d.id,
        title: d.title,
        category: d.category,
        document_url: d.document_url,
        notes: d.notes,
        valid_until: d.valid_until,
        expiry,
        expiresLabel: d.valid_until
          ? dayFmt.format(new Date(`${d.valid_until}T12:00:00Z`))
          : null,
      };
    })
    .sort(
      (a, b) =>
        EXPIRY_ORDER[a.expiry] - EXPIRY_ORDER[b.expiry] ||
        (a.valid_until ?? "").localeCompare(b.valid_until ?? "") ||
        a.title.localeCompare(b.title),
    );
  // The slug too: this screen lists contracts that need attention and then
  // printed both the contract and its client as dead text, so acting on one
  // meant finding it by hand from the client list.
  const clientOf = new Map(
    (clients ?? []).map((c) => [c.id, { name: c.name, slug: c.slug }]),
  );
  const rows = contracts ?? [];
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mb-10">
        <CompanyDocuments docs={docs} locale={locale} />
      </div>

      <h2 className="mb-3 font-display text-xl leading-snug">
        {t("clientDocs")}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="min-w-0">
                {(() => {
                  const client = clientOf.get(c.client_id);
                  return client ? (
                    <Link
                      href={
                        `/clients/${client.slug}/contracts/${c.id}/edit` as Route
                      }
                      className="font-medium text-foreground hover:text-brand hover:underline"
                    >
                      {c.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{c.title}</span>
                  );
                })()}
                <span className="ml-2 text-xs text-muted-foreground">
                  {clientOf.get(c.client_id)?.name ?? "—"}
                </span>
              </div>
              {c.document_url ? <a href={c.document_url} target="_blank" className="text-xs text-brand">{t("open")} →</a> : null}
            </li>
          ))}
          {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">{t("empty")}</li>}
        </ul>
      </div>
    </>
  );
}
