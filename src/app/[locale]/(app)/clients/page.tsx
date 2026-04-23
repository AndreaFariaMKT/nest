import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Placeholder } from "@/components/ui/Placeholder";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import { pageMeta, parsePage } from "@/lib/pagination";
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
  const { data, count } = await supabase
    .from("clients")
    .select("id, slug, name, industry, status", { count: "exact" })
    .order("name", { ascending: true })
    .range(parsed.from, parsed.to);

  const clients = (data ?? []) as ClientRow[];
  const meta = pageMeta(parsed, count ?? clients.length);

  const pageLink = (page: number): string => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (parsed.pageSize !== PAGE_SIZE) {
      params.set("pageSize", String(parsed.pageSize));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("new")}
        </Link>
      </div>

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

          {meta.totalPages > 1 ? (
            <nav
              className="mt-8 flex items-center justify-between border-t border-border pt-4 text-sm"
              data-testid="clients-pagination"
            >
              <p className="text-muted-foreground">
                {t("pagination.range", {
                  from: parsed.from + 1,
                  to: parsed.from + clients.length,
                  total: meta.totalCount,
                })}
              </p>
              <div className="flex items-center gap-2">
                {meta.hasPrev ? (
                  <a
                    href={pageLink(parsed.page - 1)}
                    className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 hover:bg-muted"
                    data-testid="clients-prev"
                  >
                    ← {t("pagination.prev")}
                  </a>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {t("pagination.pageOf", {
                    page: meta.page,
                    total: meta.totalPages,
                  })}
                </span>
                {meta.hasNext ? (
                  <a
                    href={pageLink(parsed.page + 1)}
                    className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 hover:bg-muted"
                    data-testid="clients-next"
                  >
                    {t("pagination.next")} →
                  </a>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}

// Keep the clients page always fresh — it mutates via server actions.
export const dynamic = "force-dynamic";
