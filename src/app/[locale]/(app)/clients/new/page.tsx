import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { NewClientForm } from "./NewClientForm";

export default async function NewClientPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8">
        <Link
          href="/clients"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("title")}
        </Link>
        <h1 className="mt-2 font-display text-4xl text-foreground">
          {t("newTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("newSubtitle")}
        </p>
      </div>
      <NewClientForm locale={locale} />
    </div>
  );
}
