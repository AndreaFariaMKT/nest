import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { BrandKitForm } from "./BrandKitForm";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type BrandKit = Database["public"]["Tables"]["brand_kits"]["Row"];

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
      />
    </div>
  );
}
