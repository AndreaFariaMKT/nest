import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import {
  MeetingForm,
  type ClientChoice,
} from "../_components/MeetingForm";
import { createMeetingAction } from "../actions";

export default async function NewMeetingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("meetings");

  const supabase = await createClient();
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, name, status")
    .neq("status", "archived")
    .order("name", { ascending: true });
  const clients: ClientChoice[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link
          href="/meetings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("title")}
        </Link>
        <h1 className="mt-2 font-display text-4xl text-foreground">
          {t("newTitle")}
        </h1>
      </div>
      <MeetingForm
        locale={locale}
        clients={clients}
        action={createMeetingAction}
        submitLabel={t("createSubmit")}
      />
    </div>
  );
}
