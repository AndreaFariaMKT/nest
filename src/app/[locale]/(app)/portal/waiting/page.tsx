import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import {
  CLIENT_VISIBLE_STAGES,
  formatIsoDate,
  todayIso,
  waitingFor,
  type SocialPiece,
} from "@/lib/social";
import { PORTAL_PIECE_COLUMNS, type SocialPieceRow } from "../../social/_data";
import {
  EmptyState,
  ModuleNote,
} from "../../social/_components/Shared";
import { NotLinked } from "../_NotLinked";

export const dynamic = "force-dynamic";

/**
 * The client's own list of what is on them.
 *
 * Same `waitingFor` the studio's screens use, given only the client's cap — so
 * the reasons and the reply dates are the ones the module already computes,
 * not a second implementation that can drift from them.
 */
export default async function PortalWaiting({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, ts, client] = await Promise.all([
    getTranslations("portal"),
    getTranslations("social"),
    getPortalClient(),
  ]);
  if (!client) return <NotLinked message={t("notLinked")} />;

  const today = todayIso();
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_drafts")
    .select(PORTAL_PIECE_COLUMNS)
    .eq("client_id", client.id)
    .in("status", CLIENT_VISIBLE_STAGES)
    .order("publish_on", { ascending: true, nullsFirst: false });

  const pieces = (data ?? []) as unknown as SocialPieceRow[];

  const entries = waitingFor(["client"], {
    pieces: pieces as SocialPiece[],
    clients: new Map([
      [client.id, { name: client.name, perCycle: 1 }],
    ]),
    today,
  });

  const date = (v: string) => formatIsoDate(v, locale) ?? v;

  return (
    <>
      <PageHeader
        title={ts("waiting.title")}
        subtitle={ts("waiting.subtitleFor.client")}
      />

      <div className="mb-4 flex items-center justify-end">
        <Pill tone={entries.length ? "warning" : "success"}>
          {entries.length
            ? ts("portal.waitingCount", { n: entries.length })
            : ts("portal.allReviewed")}
        </Pill>
      </div>

      {entries.length === 0 ? (
        <EmptyState>{ts("waiting.clear")}</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {entries.map((e, i) => (
              <li key={`${e.id}-${i}`}>
                <Link
                  href={"/portal/content" as Route}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {e.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {ts(
                        `waiting.reasons.${e.reason}`,
                        Object.fromEntries(
                          Object.entries(e.values ?? {}).map(([k, v]) => [
                            k,
                            typeof v === "string" &&
                            /^\d{4}-\d{2}-\d{2}$/.test(v)
                              ? date(v)
                              : v,
                          ]),
                        ),
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ModuleNote>{ts("waiting.footnote.client")}</ModuleNote>
    </>
  );
}
