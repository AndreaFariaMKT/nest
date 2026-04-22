import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { TranscriptForm, type ClientOption } from "./TranscriptForm";

export default async function NewTranscriptPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contentEngine");

  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, status")
    .neq("status", "archived")
    .order("name", { ascending: true });
  const clients: ClientOption[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <Link
          href="/content-engine"
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
      <TranscriptForm locale={locale} clients={clients} />
    </div>
  );
}
