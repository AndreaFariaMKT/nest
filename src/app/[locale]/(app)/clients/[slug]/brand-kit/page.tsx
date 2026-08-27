import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import type { BrandColor, BrandTypography, Database } from "@/types/database";
import { BrandKitForm } from "./BrandKitForm";
import type { BrandAssetListItem } from "./BrandAssets";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type BrandKit = Omit<
  Database["public"]["Tables"]["brand_kits"]["Row"],
  "palette" | "typography"
> & {
  palette: BrandColor[] | null;
  typography: BrandTypography | null;
};
type BrandAssetRow = Database["public"]["Tables"]["brand_assets"]["Row"];

export default async function ClientBrandKitPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("brandKit");

  const supabase = await createClient();
  const { data: clientData } = await supabase
    .from("clients")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!clientData) notFound();
  const client = clientData as Pick<Client, "id" | "slug" | "name">;

  const { data: kitData } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("client_id", client.id)
    .maybeSingle();

  const kit = (kitData ?? null) as BrandKit | null;

  let assets: BrandAssetListItem[] = [];
  if (kit) {
    const { data: rawAssets } = await supabase
      .from("brand_assets")
      .select("id, kind, label, storage_path, mime_type")
      .eq("brand_kit_id", kit.id)
      .order("created_at", { ascending: false })
    .limit(OPTION_LIST_CAP);

    assets = ((rawAssets ?? []) as Pick<
      BrandAssetRow,
      "id" | "kind" | "label" | "storage_path" | "mime_type"
    >[]).map((asset) => ({
      ...asset,
      publicUrl: supabase.storage
        .from("brand-assets")
        .getPublicUrl(asset.storage_path).data.publicUrl,
    }));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <Link
          href={`/clients/${client.slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {client.name}
        </Link>
        <h1 className="mt-2 font-display text-4xl text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <BrandKitForm
        locale={locale}
        clientId={client.id}
        clientSlug={client.slug}
        defaultName={kit?.name ?? client.name}
        initial={kit}
        assets={assets}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
