import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import { ContractForm } from "../../_components/ContractForm";
import { updateContractAction, deleteContractAction } from "../../actions";
import { DeleteContractButton } from "./DeleteContractButton";
import type { Database } from "@/types/database";

type Contract = Database["public"]["Tables"]["contracts"]["Row"];

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; id: string }>;
}) {
  const { locale, slug, id } = await params;
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

  const { data: contractData } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .eq("client_id", client.id)
    .maybeSingle();
  if (!contractData) notFound();
  const contract = contractData as Contract;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/clients/${client.slug}/contracts`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("title")}
          </Link>
          <h1 className="mt-2 font-display text-4xl text-foreground">
            {t("editTitle")}
          </h1>
        </div>
        <DeleteContractButton
          contractId={contract.id}
          clientSlug={client.slug}
          locale={locale}
          label={t("delete")}
          confirmLabel={t("confirmDelete")}
        />
      </div>
      <ContractForm
        locale={locale}
        clientId={client.id}
        clientSlug={client.slug}
        initial={contract}
        action={updateContractAction}
        submitLabel={t("saveSubmit")}
        cancelHref={`/clients/${client.slug}/contracts`}
      />
    </div>
  );
}

void deleteContractAction;
