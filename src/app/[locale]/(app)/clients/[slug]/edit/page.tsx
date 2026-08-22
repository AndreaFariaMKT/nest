import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { ClientForm } from "../../_components/ClientForm";
import { updateClientAction } from "../../actions";

type Client = Database["public"]["Tables"]["clients"]["Row"];

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) notFound();
  const client = data as Client;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8">
        <Link
          href={`/clients/${client.slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {client.name}
        </Link>
        <h1 className="mt-2 font-display text-4xl text-foreground">
          {t("editTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("editSubtitle")}</p>
      </div>
      <ClientForm
        locale={locale}
        initial={{
          id: client.id,
          name: client.name,
          industry: client.industry,
          website: client.website,
          notes: client.notes,
          status: client.status,
          socialEnabled: client.social_enabled,
          postsPerCycle: client.posts_per_cycle,
        }}
        action={updateClientAction}
        submitLabel={t("saveSubmit")}
        cancelHref={`/clients/${client.slug}`}
        showStatus
      />
    </div>
  );
}
