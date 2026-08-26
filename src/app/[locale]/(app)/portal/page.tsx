import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotLinked } from "./_NotLinked";

export const dynamic = "force-dynamic";

export default async function PortalOverview({
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
  const nowIso = new Date().toISOString();

  const [{ data: meetings }, { count: awaiting }, { count: published }] =
    await Promise.all([
      supabase
        .from("meetings")
        .select("id, title, starts_at")
        .eq("client_id", client.id)
        .gte("starts_at", nowIso)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true })
        .limit(5),
      supabase
        .from("content_drafts")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        // Social pieces only — the portal dashboard counters, which must agree with the list they link to.
        .eq("engine", "social")
        // Both stages, because both are waiting on the client. This counted
        // `client_review` alone while /portal/content and /portal/waiting
        // count either — so a client with one in review and two in changes
        // read "1 waiting" here and "3 waiting" one click later. The comment
        // above says these must agree; they did not.
        .in("status", ["client_review", "changes_requested"]),
      supabase
        .from("content_drafts")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("engine", "social")
        .eq("status", "published"),
    ]);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <PageHeader
        title={t("overview.greeting", { name: client.name })}
        subtitle={t("overview.subtitle")}
      />

      <section className="mb-6 grid grid-cols-2 gap-4">
        <Stat label={t("overview.awaitingApproval")} value={String(awaiting ?? 0)} />
        <Stat label={t("overview.published")} value={String(published ?? 0)} />
      </section>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("overview.upcomingMeetings")}
        </h2>
        <ul className="divide-y divide-border">
          {(meetings ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3 text-sm">
              <span className="text-foreground">{m.title}</span>
              <span className="text-muted-foreground">
                {dateFmt.format(new Date(m.starts_at))}
              </span>
            </li>
          ))}
          {(meetings ?? []).length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              {t("overview.noMeetings")}
            </li>
          )}
        </ul>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 font-display text-3xl leading-none text-foreground">
        {value}
      </div>
    </div>
  );
}
