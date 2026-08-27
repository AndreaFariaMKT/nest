import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Placeholder } from "@/components/ui/Placeholder";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { pageMeta, parsePage } from "@/lib/pagination";
import { Pager } from "@/components/ui/Pager";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Database } from "@/types/database";

type ClientRow = Pick<
  Database["public"]["Tables"]["clients"]["Row"],
  "id" | "slug" | "name" | "industry" | "status"
>;

const statusTone = {
  prospect: "warning",
  active: "success",
  paused: "muted",
  archived: "muted",
} as const;

const PAGE_SIZE = 30;

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  const parsed = parsePage(sp, { defaultSize: PAGE_SIZE, maxSize: 100 });

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const { data, count } = await supabase
    .from("clients")
    .select("id, slug, name, industry, status", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })
    .range(parsed.from, parsed.to);

  const clients = (data ?? []) as ClientRow[];
  const meta = pageMeta(parsed, count ?? clients.length);

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link
            href="/clients/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("new")}
          </Link>
        }
      />

      {clients.length === 0 ? (
        <Placeholder>{t("empty")}</Placeholder>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.slug}`}
                className="block rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg text-foreground">
                      {client.name}
                    </h2>
                    {client.industry ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {client.industry}
                      </p>
                    ) : null}
                  </div>
                  <Pill tone={statusTone[client.status]}>
                    {t(`status.${client.status}`)}
                  </Pill>
                </div>
              </Link>
            ))}
          </div>

          <Pager
            parsed={parsed}
            meta={meta}
            shown={clients.length}
            searchParams={sp}
            defaultSize={PAGE_SIZE}
            testId="clients-pagination"
          />
        </>
      )}
    </>
  );
}

// Keep the clients page always fresh — it mutates via server actions.
export const dynamic = "force-dynamic";
