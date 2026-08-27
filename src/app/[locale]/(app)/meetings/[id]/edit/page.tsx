import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  MeetingForm,
  type ClientChoice,
} from "../../_components/MeetingForm";
import { updateMeetingAction } from "../../actions";

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("meetings");

  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const meeting = data as Meeting;

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, name, status")
    .neq("status", "archived")
    .order("name", { ascending: true })
    .limit(OPTION_LIST_CAP);
  const clients: ClientChoice[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/meetings/${meeting.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {meeting.title}
        </Link>
        <h1 className="mt-2 font-display text-4xl text-foreground">
          {t("editTitle")}
        </h1>
      </div>
      <MeetingForm
        locale={locale}
        clients={clients}
        meeting={{
          id: meeting.id,
          title: meeting.title,
          clientId: meeting.client_id,
          startsAt: meeting.starts_at,
          endsAt: meeting.ends_at,
          status: meeting.status,
          googleMeetUrl: meeting.google_meet_url,
          summary: meeting.summary,
          agendaUrl: meeting.agenda_url,
          transcriptUrl: meeting.transcript_url,
          decisions: meeting.decisions ?? [],
        }}
        action={updateMeetingAction}
        submitLabel={t("saveSubmit")}
      />
    </div>
  );
}
