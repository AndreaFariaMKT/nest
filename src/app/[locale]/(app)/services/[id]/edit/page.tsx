import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import { ServiceForm } from "../../_components/ServiceForm";
import { updateServiceAction } from "../../actions";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!(await isOwner())) notFound();
  const t = await getTranslations("services");

  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const service = data as Service;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8">
        <Link
          href="/services"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("title")}
        </Link>
        <h1 className="mt-2 font-display text-4xl text-foreground">
          {t("editTitle")}
        </h1>
      </div>
      <ServiceForm
        locale={locale}
        initial={service}
        action={updateServiceAction}
        submitLabel={t("saveSubmit")}
      />
    </div>
  );
}
