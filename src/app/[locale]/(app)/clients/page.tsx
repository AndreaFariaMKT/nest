import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Placeholder } from "@/components/ui/Placeholder";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
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

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, slug, name, industry, status")
    .order("name", { ascending: true });

  const clients = (data ?? []) as ClientRow[];

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
      )}
    </>
  );
}

// Keep the clients page always fresh — it mutates via server actions.
export const dynamic = "force-dynamic";
