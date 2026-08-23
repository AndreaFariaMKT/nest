import { notFound } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Client = {
  id: string;
  name: string;
};

type ScheduledRow = {
  id: string;
  scheduled_for: string;
  platform: string;
  post_type: string;
  status: string;
  draft: { title: string; caption: string | null };
};

type PublishedRow = {
  id: string;
  platform: string;
  post_type: string;
  published_at: string;
  external_id: string;
  permalink: string | null;
  draft: { title: string };
};

type PendingApproval = {
  id: string;
  token: string;
  expires_at: string | null;
  created_at: string;
  draft: { title: string; client_id: string };
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

// Chooses locale from ?locale=en|pt-BR — defaults to pt-BR.
export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const rawLocale = (Array.isArray(sp.locale) ? sp.locale[0] : sp.locale) ?? "pt-BR";
  const locale = rawLocale.startsWith("en") ? "en" : "pt-BR";

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: clientRow } = await admin
    .from("clients")
    .select("id, name, portal_token_expires_at")
    .eq("portal_token", token)
    .neq("status", "archived")
    .maybeSingle();
  // Enforced here rather than in RLS: this route is anonymous and reads with
  // the service role, so there is no policy in the path to carry the rule.
  // Null means a token minted before 030 — those keep working until rotated.
  const expired =
    !!clientRow?.portal_token_expires_at &&
    new Date(clientRow.portal_token_expires_at).getTime() < Date.now();
  // notFound, not a "link expired" page: an expired token and a wrong one must
  // be indistinguishable, or the 404 tells a stranger which guesses were close.
  if (!clientRow || expired) notFound();
  const client = clientRow as Client;

  // Upcoming scheduled posts (status pending/scheduled/published, in the
  // scheduled_posts table; scoped via draft.client_id join).
  type ScheduledShape = {
    id: string;
    scheduled_for: string;
    platform: string;
    post_type: string;
    status: string;
    draft:
      | { title: string; caption: string | null; client_id: string }
      | Array<{ title: string; caption: string | null; client_id: string }>
      | null;
  };
  const { data: scheduledData } = await admin
    .from("scheduled_posts")
    // Scoped in SQL, not only in the map below. The limit used to be applied
    // BEFORE the client filter, so a client with busy peers silently saw fewer
    // of their own rows than exist — and every other tenant's captions and
    // titles transited this server process on the way to being discarded,
    // which is one careless log line away from being a leak.
    .select(
      "id, scheduled_for, platform, post_type, status, draft:content_drafts!inner(title, caption, client_id)",
    )
    .eq("draft.client_id", client.id)
    .gte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(20);
  const scheduled: ScheduledRow[] = ((scheduledData ?? []) as unknown as ScheduledShape[])
    .map((r) => {
      const d = pickOne(r.draft);
      if (!d || d.client_id !== client.id) return null;
      return {
        id: r.id,
        scheduled_for: r.scheduled_for,
        platform: r.platform,
        post_type: r.post_type,
        status: r.status,
        draft: { title: d.title, caption: d.caption },
      };
    })
    .filter((x): x is ScheduledRow => x !== null)
    .slice(0, 10);

  type PublishedShape = {
    id: string;
    platform: string;
    post_type: string;
    published_at: string;
    external_id: string;
    permalink: string | null;
    draft:
      | { title: string; client_id: string }
      | Array<{ title: string; client_id: string }>
      | null;
  };
  const { data: publishedData } = await admin
    .from("published_posts")
    .select(
      "id, platform, post_type, published_at, external_id, permalink, draft:content_drafts!inner(title, client_id)",
    )
    .eq("draft.client_id", client.id)
    .order("published_at", { ascending: false })
    .limit(30);
  const published: PublishedRow[] = ((publishedData ?? []) as unknown as PublishedShape[])
    .map((r) => {
      const d = pickOne(r.draft);
      if (!d || d.client_id !== client.id) return null;
      return {
        id: r.id,
        platform: r.platform,
        post_type: r.post_type,
        published_at: r.published_at,
        external_id: r.external_id,
        permalink: r.permalink,
        draft: { title: d.title },
      };
    })
    .filter((x): x is PublishedRow => x !== null)
    .slice(0, 10);

  type ApprovalShape = {
    id: string;
    token: string;
    expires_at: string | null;
    created_at: string;
    approved_at: string | null;
    rejected_at: string | null;
    draft:
      | { title: string; client_id: string }
      | Array<{ title: string; client_id: string }>
      | null;
  };
  const { data: approvalsData } = await admin
    .from("approvals")
    .select(
      "id, token, expires_at, created_at, approved_at, rejected_at, draft:content_drafts!inner(title, client_id)",
    )
    .eq("draft.client_id", client.id)
    .is("approved_at", null)
    .is("rejected_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  const nowMs = Date.now();
  const pending: PendingApproval[] = ((approvalsData ?? []) as unknown as ApprovalShape[])
    .map((r) => {
      const d = pickOne(r.draft);
      if (!d || d.client_id !== client.id) return null;
      if (r.expires_at && new Date(r.expires_at).getTime() < nowMs) return null;
      return {
        id: r.id,
        token: r.token,
        expires_at: r.expires_at,
        created_at: r.created_at,
        draft: { title: d.title, client_id: d.client_id },
      };
    })
    .filter((x): x is PendingApproval => x !== null)
    .slice(0, 10);

  const t = I18N[locale];
  const dtf = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const dateOnlyFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-background px-6 py-10">
      <header className="mb-8 border-b border-border pb-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {t.kicker}
        </div>
        <h1 className="mt-1 font-display text-3xl text-foreground">
          {client.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </header>

      <section className="mb-10" data-testid="portal-upcoming">
        <h2 className="mb-3 font-display text-xl">{t.upcomingTitle}</h2>
        {scheduled.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.upcomingEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {scheduled.map((row) => (
              <li
                key={row.id}
                className="rounded-md border border-border bg-card px-4 py-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{row.draft.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dtf.format(new Date(row.scheduled_for))}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {row.platform} · {row.post_type} · {row.status}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10" data-testid="portal-pending">
        <h2 className="mb-3 font-display text-xl">{t.pendingTitle}</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.pendingEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((row) => (
              <li
                key={row.id}
                className="rounded-md border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/40"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{row.draft.title}</span>
                  <a
                    href={`/a/${row.token}?locale=${locale}`}
                    className="shrink-0 text-xs font-medium underline"
                  >
                    {t.openApproval}
                  </a>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t.sentOn} {dateOnlyFmt.format(new Date(row.created_at))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-testid="portal-published">
        <h2 className="mb-3 font-display text-xl">{t.publishedTitle}</h2>
        {published.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.publishedEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {published.map((row) => (
              <li
                key={row.id}
                className="rounded-md border border-border bg-card px-4 py-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{row.draft.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dateOnlyFmt.format(new Date(row.published_at))}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {row.platform} · {row.post_type}
                  {row.permalink ? (
                    <>
                      {" · "}
                      <a
                        href={row.permalink}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline"
                      >
                        {t.viewPost}
                      </a>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
        {t.footer}
      </footer>
    </main>
  );
}

const I18N = {
  "pt-BR": {
    kicker: "Portal do cliente",
    subtitle:
      "Acompanhe os próximos posts, o que já foi publicado e o que tá esperando sua aprovação.",
    upcomingTitle: "Próximos posts",
    upcomingEmpty: "Nada agendado por enquanto.",
    pendingTitle: "Esperando sua aprovação",
    pendingEmpty: "Nenhuma aprovação pendente.",
    openApproval: "Abrir pra aprovar",
    sentOn: "Enviado em",
    publishedTitle: "Já publicados",
    publishedEmpty: "Ainda não há posts publicados.",
    viewPost: "Ver post",
    footer:
      "Esse link é de leitura e dá acesso direto ao seu conteúdo. Guarde com carinho — peça um novo ao studio se precisar.",
  },
  en: {
    kicker: "Client portal",
    subtitle:
      "See upcoming posts, what's already live, and anything waiting on your approval.",
    upcomingTitle: "Upcoming posts",
    upcomingEmpty: "Nothing scheduled at the moment.",
    pendingTitle: "Waiting on your approval",
    pendingEmpty: "No approvals pending.",
    openApproval: "Open to approve",
    sentOn: "Sent",
    publishedTitle: "Already published",
    publishedEmpty: "No posts have gone live yet.",
    viewPost: "View post",
    footer:
      "This is a read-only link with direct access to your content — keep it safe, or ask the studio for a new one.",
  },
} as const;
