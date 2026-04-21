import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Placeholder>{t("empty")}</Placeholder>
    </>
  );
}
