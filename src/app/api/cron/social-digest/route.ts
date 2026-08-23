import { NextResponse, type NextRequest } from "next/server";

import en from "../../../../../messages/en.json";
import ptBR from "../../../../../messages/pt-BR.json";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";
import { todayIso, CLIENT_VISIBLE_STAGES } from "@/lib/social";
import { buildDigest, digestBody, type DigestPiece } from "@/lib/social-digest";

export const dynamic = "force-dynamic";
// The run walks clients serially. Belt against the platform default while that
// is still the shape.
export const maxDuration = 60;

/**
 * Daily cron — one message per client, never a ping per piece.
 *
 * Each hand-off used to notify immediately, which is how a client ends up with
 * four notifications on a Tuesday and stops reading them. This gathers the day
 * into a single line: what arrived, what is due today, and what has run past
 * its reply date.
 *
 * `clients.social_digest_at` records the last successful send, so a missed run
 * does not swallow a day's arrivals — the next run picks them up. Clients with
 * nothing to say are skipped entirely; a digest that says "nothing happened" is
 * how a digest becomes noise.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`, like every other cron here.
 */

const DICTS: Record<string, typeof en> = {
  en,
  "pt-BR": ptBR as unknown as typeof en,
};

/** Reads `social.digest.*` from the client's own locale, falling back to pt-BR. */
function translatorFor(locale: string | null) {
  const dict = DICTS[locale ?? ""] ?? DICTS["pt-BR"];
  const digest = (
    dict.social as unknown as {
      digest: Record<string, string>;
    }
  ).digest;
  return (key: string, values?: Record<string, number>) => {
    const raw = digest[key] ?? key;
    return values
      ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""))
      : raw;
  };
}

async function handler(request: NextRequest) {
  const ip = ipFromHeaders(request.headers);
  const rl = checkRateLimit({
    key: `cron.social-digest:${ip}`,
    limit: 6,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429 },
    );
  }

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "no_cron_secret" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = todayIso();

  // Only clients with someone to write to and the module switched on.
  const { data: clients, error } = await admin
    .from("clients")
    .select("id, name, portal_user_id, social_digest_at")
    .eq("social_enabled", true)
    .neq("status", "archived")
    .not("portal_user_id", "is", null);

  if (error) {
    log.error("cron.social-digest", "clients_query_failed", {
      message: error.message,
    });
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const summary = { clients: 0, sent: 0, skipped: 0, failed: 0 };
  const sentAt = new Date().toISOString();

  for (const client of clients ?? []) {
    summary.clients += 1;

    const { data: rows } = await admin
      .from("content_drafts")
      .select("id, title, publish_on, sent_to_client_at")
      .eq("client_id", client.id)
      .in("status", ["client_review", "changes_requested"]);

    const digest = buildDigest(
      (rows ?? []) as DigestPiece[],
      today,
      client.social_digest_at,
    );

    if (digest.empty) {
      summary.skipped += 1;
      continue;
    }

    // The client's own reading language, not the studio's.
    const { data: profile } = await admin
      .from("profiles")
      .select("locale")
      .eq("id", client.portal_user_id!)
      .maybeSingle();

    const t = translatorFor(profile?.locale ?? null);

    const { error: notifyError } = await admin.from("notifications").insert({
      user_id: client.portal_user_id!,
      type: "social_digest",
      title: t("title"),
      body: digestBody(digest, t),
      link: "/portal/content",
    });

    if (notifyError) {
      summary.failed += 1;
      log.error("cron.social-digest", "notify_failed", {
        clientId: client.id,
        message: notifyError.message,
      });
      continue;
    }

    // Only stamped after a successful send, so a failure is retried tomorrow
    // with the same window rather than being lost.
    await admin
      .from("clients")
      .update({ social_digest_at: sentAt })
      .eq("id", client.id);

    summary.sent += 1;
  }

  log.info("cron.social-digest", "done", summary);
  return NextResponse.json({ ok: true, summary, visible: CLIENT_VISIBLE_STAGES.length });
}

export { handler as GET, handler as POST };
