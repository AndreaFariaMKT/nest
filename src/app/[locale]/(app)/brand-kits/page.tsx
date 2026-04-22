import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import type { BrandColor, Database } from "@/types/database";

type Row = {
  id: string;
  name: string;
  palette: BrandColor[];
  typography:
    | Database["public"]["Tables"]["brand_kits"]["Row"]["typography"]
    | null;
  client:
    | { slug: string; name: string }
    | Array<{ slug: string; name: string }>
    | null;
};

export default async function BrandKitsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("brandKits");

  const supabase = await createClient();
  const { data } = await supabase
    .from("brand_kits")
    .select("id, name, palette, typography, client:clients!inner(slug, name)")
    .order("updated_at", { ascending: false });

  const kits = ((data ?? []) as unknown as Row[]).map((kit) => {
    const client = Array.isArray(kit.client) ? kit.client[0] : kit.client;
    return { ...kit, client };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {kits.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {kits.map((kit) =>
            kit.client ? (
              <Link
                key={kit.id}
                href={`/clients/${kit.client.slug}/brand-kit`}
                className="block rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent/30"
                data-testid="brand-kit-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg text-foreground">
                      {kit.client.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {kit.name}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {kit.palette?.length ?? 0} {t("colorsSuffix")}
                  </span>
                </div>
                {kit.palette && kit.palette.length > 0 ? (
                  <div className="mt-4 flex gap-1.5">
                    {kit.palette.slice(0, 8).map((color, index) => (
                      <div
                        key={`${color.hex}-${index}`}
                        className="h-6 w-6 rounded-md border border-border"
                        style={{ backgroundColor: color.hex }}
                        title={`${color.name} · ${color.hex}`}
                      />
                    ))}
                  </div>
                ) : null}
                {kit.typography?.headings || kit.typography?.body ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {[kit.typography.headings, kit.typography.body]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </Link>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
