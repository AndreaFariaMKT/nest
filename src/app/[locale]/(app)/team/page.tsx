import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("team");
  const tCommon = await getTranslations("common");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Placeholder>{tCommon("comingSoon")}</Placeholder>
    </>
  );
}
