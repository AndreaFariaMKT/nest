import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import { ContractForm } from "../_components/ContractForm";
import { createContractAction } from "../actions";

export default async function NewContractPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!(await isOwner())) notFound();

  const t = await getTranslations("contracts");

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8">
        <Link
          href={`/clients/${client.slug}/contracts`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("title")}
        </Link>
        <h1 className="mt-2 font-display text-4xl text-foreground">
          {t("newTitle")}
        </h1>
      </div>
      <ContractForm
        locale={locale}
        clientId={client.id}
        clientSlug={client.slug}
        action={createContractAction}
        submitLabel={t("createSubmit")}
        cancelHref={`/clients/${client.slug}/contracts`}
      />
    </div>
  );
}
