import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotLinked } from "../_NotLinked";

export const dynamic = "force-dynamic";

export default async function PortalMeetings({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tm] = await Promise.all([
    getTranslations("portal"),
    getTranslations("meetings"),
  ]);
  const client = await getPortalClient();
  if (!client) return <NotLinked message={t("notLinked")} />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("id, title, starts_at, google_meet_url, status, summary, agenda_url, transcript_url, decisions")
    .eq("client_id", client.id)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });
  const meetings = data ?? [];
  const now = Date.now();
  const df = new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <PageHeader title={t("meetings.title")} subtitle={t("meetings.subtitle")} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {meetings.map((m) => (
            <li key={m.id} className="px-4 py-3.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{m.title}</span>
                  <span className="text-xs text-muted-foreground">{df.format(new Date(m.starts_at))}{new Date(m.starts_at).getTime() < now ? " · " + t("meetings.past") : ""}</span>
                </div>
                {m.google_meet_url ? (
                  <a
                    href={m.google_meet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-brand hover:underline"
                  >
                    Meet →
                  </a>
                ) : null}
              </div>

              {m.summary ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {m.summary}
                </p>
              ) : null}

              {/* The decision list is the part of a meeting that has to survive
                  it — the client had no way to see it before. */}
              {m.decisions?.length ? (
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-brand">
                    {tm("fields.decisions")}
                  </p>
                  <ul className="space-y-1">
                    {m.decisions.map((d: string, i: number) => (
                      <li
                        key={i}
                        className="relative pl-4 text-sm leading-relaxed text-foreground before:absolute before:left-0 before:top-2.5 before:h-px before:w-2 before:bg-brand"
                      >
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {m.agenda_url || m.transcript_url ? (
                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  {m.agenda_url ? (
                    <a href={m.agenda_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                      {tm("fields.agendaUrl")}
                    </a>
                  ) : null}
                  {m.transcript_url ? (
                    <a href={m.transcript_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                      {tm("fields.transcriptUrl")}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
          {meetings.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">{t("meetings.empty")}</li>
          )}
        </ul>
      </div>
    </>
  );
}
