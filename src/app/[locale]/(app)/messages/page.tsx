import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { getSessionUser } from "@/lib/auth";
import { getCurrentRole } from "@/lib/roles-server";
import { canUseSocial, hasCap } from "@/lib/social";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import { ComposeMessage } from "./ComposeMessage";
import { LiveMessages } from "./LiveMessages";

export const dynamic = "force-dynamic";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  client_id: string | null;
  room: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * One room per client for the team, one for the client, plus the studio-wide
 * channel. They never mix: a client never sees a team room, and never sees
 * another client at all.
 */
export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("messages");
  const sp = await searchParams;

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const [user, role, { data: people }, { data: clientData }] = await Promise.all([
    getSessionUser(),
    getCurrentRole(),
    supabase.from("profiles").select("id, full_name").limit(OPTION_LIST_CAP),
    supabase
      .from("clients")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .neq("status", "archived")
      .order("name")
      .limit(OPTION_LIST_CAP),
  ]);

  // Who gets to see what. A room list built from every client used to render
  // for anyone with `messages` in their sidebar — including accountant,
  // developer and designer_identity, none of whom have any business reading a
  // client's production talk. RLS permits it (016), so the gate has to be here
  // as well as in migration 022.
  const seesTeamRooms = canUseSocial(role);
  const seesClientRooms =
    hasCap(role, "coordinate") || hasCap(role, "direction");

  const clients = seesTeamRooms ? (clientData ?? []) : [];
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name ?? ""]));

  // Room key: "" for the studio channel, "<clientId>:<room>" otherwise.
  const rooms = [
    { key: "", label: t("studioChannel"), kind: "team" as const, clientId: "" },
    ...clients.flatMap((c) => [
      {
        key: `${c.id}:team`,
        label: c.name,
        kind: "team" as const,
        clientId: c.id,
      },
      ...(seesClientRooms
        ? [
            {
              key: `${c.id}:client`,
              label: c.name,
              kind: "client" as const,
              clientId: c.id,
            },
          ]
        : []),
    ]),
  ];

  const rawRoom = Array.isArray(sp.room) ? sp.room[0] : sp.room;
  const active = rooms.find((r) => r.key === rawRoom) ?? rooms[0];

  // Scoped server-side and taken newest-first. Reading ascending with a LIMIT
  // returns the OLDEST rows, so once a tenant passes the limit nothing new ever
  // appears again — including in the studio channel.
  let scoped = supabase
    .from("messages")
    .select("id, body, sender_id, created_at, client_id, room")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);
  scoped = active.clientId
    ? scoped.eq("client_id", active.clientId).eq("room", active.kind)
    : scoped.is("client_id", null);

  // Sidebar previews: the recent tail across the rooms this reader may see, so
  // one query serves every preview without competing with the thread above.
  const [{ data: threadData }, { data: recentData }] = await Promise.all([
    scoped,
    supabase
      .from("messages")
      .select("id, body, sender_id, created_at, client_id, room")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const messages = ((threadData ?? []) as Message[]).slice().reverse();
  const recent = (recentData ?? []) as Message[];

  const lastIn = (key: string) => {
    const room = rooms.find((r) => r.key === key);
    if (!room) return null;
    return (
      recent.find((m) =>
        room.clientId
          ? m.client_id === room.clientId && m.room === room.kind
          : m.client_id === null,
      ) ?? null
    );
  };

  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t("title")} subtitle={t("roomsSubtitle")} />

      <div className="grid min-h-0 flex-1 gap-0 overflow-hidden rounded-2xl border border-border lg:grid-cols-[290px_1fr]">
        <aside className="max-h-64 overflow-y-auto border-b border-border bg-muted/40 lg:max-h-none lg:border-b-0 lg:border-r">
          {rooms.map((r, i) => {
            const last = lastIn(r.key);
            const isFirstOfClient =
              r.kind === "team" && r.clientId && rooms[i - 1]?.clientId !== r.clientId;
            return (
              <div key={r.key || "studio"}>
                {isFirstOfClient ? (
                  <p className="px-4 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-brand">
                    {r.label}
                  </p>
                ) : null}
                <Link
                  href={
                    (r.key ? `/messages?room=${r.key}` : "/messages") as Route
                  }
                  className={cn(
                    "flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-card",
                    active.key === r.key &&
                      "bg-card shadow-[inset_2px_0_0_var(--brand,currentColor)]",
                  )}
                >
                  <Pill
                    tone={r.kind === "team" ? "brand" : "success"}
                    className="mt-0.5 shrink-0 text-[9px] uppercase tracking-wider"
                  >
                    {t(r.kind === "team" ? "roomTeam" : "roomClient")}
                  </Pill>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-muted-foreground">
                      {r.clientId
                        ? t(r.kind === "team" ? "teamRoomWho" : "clientRoomWho")
                        : t("studioChannelWho")}
                    </span>
                    <span className="mt-0.5 block truncate text-xs">
                      {last?.body ?? t("noMessagesYet")}
                    </span>
                  </span>
                </Link>
              </div>
            );
          })}
        </aside>

        <section className="flex min-h-0 flex-col bg-card">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 text-sm">
            <span>
              {active.clientId
                ? `${t(active.kind === "team" ? "teamRoom" : "clientRoom")} · ${active.label}`
                : t("studioChannel")}
            </span>
            <Pill tone={active.kind === "team" ? "muted" : "brand"} className="text-[10px]">
              {t(active.kind === "team" ? "internalOnly" : "clientReadsThis")}
            </Pill>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("empty")}
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === user?.id;
                const label = mine ? t("you") : nameOf.get(m.sender_id) || "—";
                return (
                  <div
                    key={m.id}
                    className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand-soft-foreground">
                      {initials(label)}
                    </span>
                    <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                      <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{label}</span>
                        <span>{timeFmt.format(new Date(m.created_at))}</span>
                      </div>
                      <div
                        className={`inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? "bg-brand text-brand-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {m.body}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border p-3">
            <ComposeMessage
              locale={locale}
              clientId={active.clientId || undefined}
              room={active.kind}
              placeholder={t("placeholder")}
              sendLabel={t("send")}
            />
            <LiveMessages
              clientId={active.clientId || null}
              room={active.kind}
              selfId={user?.id ?? null}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
