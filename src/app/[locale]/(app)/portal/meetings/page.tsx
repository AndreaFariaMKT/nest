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
  const t = await getTranslations("portal");
  const client = await getPortalClient();
  if (!client) return <NotLinked message={t("notLinked")} />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("id, title, starts_at, google_meet_url, status")
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
            <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="min-w-0">
                <span className="block truncate font-medium text-foreground">{m.title}</span>
                <span className="text-xs text-muted-foreground">{df.format(new Date(m.starts_at))}{new Date(m.starts_at).getTime() < now ? " · " + t("meetings.past") : ""}</span>
              </div>
              {m.google_meet_url ? (
                <a href={m.google_meet_url} target="_blank" className="text-xs text-brand">Meet →</a>
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
