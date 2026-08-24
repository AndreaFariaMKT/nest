import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { isOwner } from "@/lib/roles-server";
import { ServiceForm } from "../_components/ServiceForm";
import { createServiceAction } from "../actions";

export default async function NewServicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await isOwner())) notFound();
  const t = await getTranslations("services");

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
          {t("newTitle")}
        </h1>
      </div>
      <ServiceForm
        locale={locale}
        action={createServiceAction}
        submitLabel={t("createSubmit")}
      />
    </div>
  );
}
