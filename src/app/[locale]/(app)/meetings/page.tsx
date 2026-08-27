import { STUDIO_TIMEZONE } from "@/lib/social";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Pill } from "@/components/ui/Pill";
import {
  OPTION_LIST_CAP,
  pageMeta,
  parsePage,
} from "@/lib/pagination";
import { Pager } from "@/components/ui/Pager";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import type { Database, MeetingStatus } from "@/types/database";

type Meeting = Pick<
  Database["public"]["Tables"]["meetings"]["Row"],
  | "id"
  | "title"
  | "starts_at"
  | "ends_at"
  | "status"
  | "google_meet_url"
  | "client_id"
  | "summary"
  | "decisions"
>;

type JoinedMeeting = Meeting & {
  client: { name: string } | Array<{ name: string }> | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function statusTone(
  s: MeetingStatus,
): "default" | "success" | "warning" | "danger" {
  if (s === "completed") return "success";
  if (s === "cancelled") return "danger";
  return "default";
}

const PAGE_SIZE = 25;

const SELECT =
  "id, title, starts_at, ends_at, status, google_meet_url, client_id, client:clients(name), summary, decisions";

export default async function MeetingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("meetings");

  const parsed = parsePage(sp, { defaultSize: PAGE_SIZE, maxSize: 100 });

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  // Two reads, not one. This screen used to fetch every meeting the tenant had
  // ever held and split them in JavaScript — so the cost grew with history
  // even though the top half of the page only ever shows the future. Only the
  // past grows without bound, so only the past is paged; splitting in SQL also
  // lets each half carry its own sort instead of reversing an array.
  const nowIso = new Date().toISOString();
  const [{ data: upcomingData }, { data: pastData, count: pastCount }] =
    await Promise.all([
      supabase
        .from("meetings")
        .select(SELECT)
        .eq("tenant_id", tenantId)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(OPTION_LIST_CAP),
      supabase
        .from("meetings")
        .select(SELECT, { count: "exact" })
        .eq("tenant_id", tenantId)
        .lt("starts_at", nowIso)
        .order("starts_at", { ascending: false })
        .range(parsed.from, parsed.to),
    ]);

  const upcoming = (upcomingData ?? []) as unknown as JoinedMeeting[];
  const past = (pastData ?? []) as unknown as JoinedMeeting[];
  const meta = pageMeta(parsed, pastCount ?? past.length);

  const dtf = new Intl.DateTimeFormat(locale, {
    timeZone: STUDIO_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });

  function MeetingRow({ m }: { m: JoinedMeeting }) {
    const client = pickOne(m.client);
    return (
      <li
        className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-muted"
        data-testid="meeting-row"
      >
        <Link
          href={`/meetings/${m.id}`}
          className="flex items-center gap-4 text-foreground"
        >
          <div className="flex-1">
            <div className="font-medium">{m.title}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{dtf.format(new Date(m.starts_at))}</span>
              {client ? (
                <>
                  <span>·</span>
                  <span>{client.name}</span>
                </>
              ) : null}
            </div>
          </div>
          <Pill tone={statusTone(m.status)}>{t(`status.${m.status}`)}</Pill>
        </Link>

        {/* The decision list is the part of a meeting that has to survive it,
            so it belongs on the list — not one click further in. */}
        {m.decisions?.length ? (
          <ul className="mt-2 space-y-1 border-t border-border pt-2">
            {m.decisions.map((d: string, i: number) => (
              <li
                key={i}
                className="relative pl-4 text-xs leading-relaxed text-muted-foreground before:absolute before:left-0 before:top-2 before:h-px before:w-2 before:bg-primary"
              >
                {d}
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link
            href="/meetings/new"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            data-testid="meetings-new"
          >
            {t("new")}
          </Link>
        }
      />

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl">{t("sections.upcoming")}</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("sections.upcomingEmpty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((m) => (
              <MeetingRow key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl">{t("sections.past")}</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("sections.pastEmpty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {past.map((m) => (
              <MeetingRow key={m.id} m={m} />
            ))}
          </ul>
        )}
        <Pager
          parsed={parsed}
          meta={meta}
          shown={past.length}
          searchParams={sp}
          defaultSize={PAGE_SIZE}
          testId="meetings-pagination"
        />
      </section>
    </>
  );
}
