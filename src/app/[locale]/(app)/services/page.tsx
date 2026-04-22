import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import { formatCentsAsBrl } from "@/lib/money";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services");

  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .order("name", { ascending: true });
  const services = (data ?? []) as Service[];

  const canWrite = await isOwner();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canWrite ? (
          <Link
            href="/services/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("new")}
          </Link>
        ) : null}
      </div>

      {services.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((service) => {
            const label = (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg">{service.name}</h2>
                  {service.description ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-sm">
                  {formatCentsAsBrl(service.default_monthly_cents)}
                </div>
              </div>
            );
            return canWrite ? (
              <Link
                key={service.id}
                href={`/services/${service.id}/edit`}
                className="block rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent/30"
              >
                {label}
              </Link>
            ) : (
              <div
                key={service.id}
                className="rounded-lg border border-border bg-card p-5"
              >
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
