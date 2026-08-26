import { STUDIO_TIMEZONE } from "@/lib/social";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import type { Database, MeetingStatus } from "@/types/database";
import { deleteMeetingAction } from "../actions";
import { generateCarouselsAction } from "../../content-engine/actions";

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
type Transcript = Pick<
  Database["public"]["Tables"]["transcripts"]["Row"],
  "id" | "language" | "content" | "created_at"
>;

function statusTone(
  s: MeetingStatus,
): "default" | "success" | "warning" | "danger" {
  if (s === "completed") return "success";
  if (s === "cancelled") return "danger";
  return "default";
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function MeetingDetailPage({
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
    .select(
      "id, client_id, title, starts_at, ends_at, status, google_meet_url, summary, agenda_url, transcript_url, decisions, created_at, updated_at, google_event_id, created_by, client:clients(id, name, slug)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  type JoinedMeeting = Meeting & {
    client:
      | { id: string; name: string; slug: string }
      | Array<{ id: string; name: string; slug: string }>
      | null;
  };
  const meeting = data as unknown as JoinedMeeting;
  const client = pickOne(meeting.client);

  const { data: transcriptsData } = await supabase
    .from("transcripts")
    .select("id, language, content, created_at")
    .eq("meeting_id", id)
    .order("created_at", { ascending: false });
  const transcripts = (transcriptsData ?? []) as Transcript[];

  const dtf = new Intl.DateTimeFormat(locale, {
    timeZone: STUDIO_TIMEZONE,
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/meetings"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("title")}
          </Link>
          <h1 className="mt-2 font-display text-4xl text-foreground">
            {meeting.title}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Pill tone={statusTone(meeting.status)}>
              {t(`status.${meeting.status}`)}
            </Pill>
            <span>{dtf.format(new Date(meeting.starts_at))}</span>
            {client ? (
              <>
                <span>·</span>
                <Link
                  href={`/clients/${client.slug}`}
                  className="hover:text-foreground"
                >
                  {client.name}
                </Link>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/meetings/${meeting.id}/edit`}
            className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
            data-testid="meeting-edit-link"
          >
            {t("actions.edit")}
          </Link>
          <form action={deleteMeetingAction}>
            <input type="hidden" name="meetingId" value={meeting.id} />
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md border border-destructive/40 bg-background px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
              data-testid="meeting-delete"
            >
              {t("actions.delete")}
            </button>
          </form>
        </div>
      </div>

      {meeting.google_meet_url ? (
        <section className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
            {t("fields.meetUrl")}
          </div>
          <a
            href={meeting.google_meet_url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-primary hover:underline"
          >
            {meeting.google_meet_url}
          </a>
        </section>
      ) : null}

      {meeting.summary ? (
        <section className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
            {t("fields.summary")}
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            {meeting.summary}
          </p>
        </section>
      ) : null}

      {/* The decision list is what anyone reads three months later. */}
      {meeting.decisions?.length ? (
        <section className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            {t("fields.decisions")}
          </div>
          <ul className="space-y-1.5">
            {meeting.decisions.map((d: string, i: number) => (
              <li
                key={i}
                className="relative pl-4 text-sm leading-relaxed text-foreground before:absolute before:left-0 before:top-2.5 before:h-px before:w-2 before:bg-primary"
              >
                {d}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {meeting.agenda_url || meeting.transcript_url ? (
        <section className="mb-6 flex flex-wrap gap-4 text-sm">
          {meeting.agenda_url ? (
            <a
              href={meeting.agenda_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary hover:underline"
            >
              {t("fields.agendaUrl")}
            </a>
          ) : null}
          {meeting.transcript_url ? (
            <a
              href={meeting.transcript_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary hover:underline"
            >
              {t("fields.transcriptUrl")}
            </a>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-xl">
          {t("sections.transcripts")}
        </h2>
        {transcripts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("sections.transcriptsEmpty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {transcripts.map((tr) => (
              <li
                key={tr.id}
                className="rounded-md border border-border bg-card px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    {new Intl.DateTimeFormat(locale, {
    timeZone: STUDIO_TIMEZONE,
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(tr.created_at))}
                  </span>
                  <span>
                    {tr.language} · {tr.content.trim().split(/\s+/).length}{" "}
                    {t("transcriptWords")}
                  </span>
                </div>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <Link
                    href={`/content-engine/transcripts/${tr.id}`}
                    className="flex-1 hover:text-foreground"
                  >
                    {tr.content.slice(0, 140)}
                    {tr.content.length > 140 ? "…" : ""}
                  </Link>
                  <form action={generateCarouselsAction} className="shrink-0">
                    <input type="hidden" name="transcriptId" value={tr.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
                      data-testid="generate-from-meeting"
                    >
                      {t("actions.generateCarousels")}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
