import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  publishCarousel,
  readCredentials,
  InstagramApiError,
} from "@/lib/instagram";
import {
  publishCarousel as publishCarouselLinkedIn,
  readCredentials as readLinkedInCredentials,
  LinkedInApiError,
} from "@/lib/linkedin";
import { log } from "@/lib/log";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint — processes due `scheduled_posts`.
 *
 * Behavior per run (processes up to `BATCH_SIZE` rows):
 *   1. Find rows where `status = 'pending'` and `scheduled_for <= now()`
 *   2. For each IG carousel: gather latest creatives → publishCarousel →
 *      insert `published_posts` row → set `scheduled_posts.status = 'published'`
 *      and `content_drafts.status = 'published'`.
 *   3. On failure: increment `attempt_count`, write `last_error`; after the
 *      3rd failure, flip `status = 'failed'` so the row stops getting picked.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
 *
 * When Meta credentials aren't configured, the endpoint returns 503 with the
 * missing env list so Vercel Cron logs surface the blocker clearly. It does
 * NOT touch `attempt_count` in that case (the row will be retried once creds
 * land).
 */

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

type ScheduledRow = {
  id: string;
  draft_id: string;
  platform: "instagram" | "linkedin" | "tiktok";
  post_type: "carousel" | "single_image" | "reel" | "story" | "text";
  scheduled_for: string;
  attempt_count: number;
};

type DraftWithSlides = {
  id: string;
  caption: string | null;
  hashtags: string[];
  slides:
    | Array<{
        position: number;
        creatives:
          | Array<{ image_url: string; version: number }>
          | { image_url: string; version: number }
          | null;
      }>
    | null;
};

function extractImageUrls(draft: DraftWithSlides): string[] {
  const slides = [...(draft.slides ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const urls: string[] = [];
  for (const s of slides) {
    const list = Array.isArray(s.creatives)
      ? s.creatives
      : s.creatives
        ? [s.creatives]
        : [];
    if (list.length === 0) continue;
    const latest = [...list].sort((a, b) => b.version - a.version)[0];
    urls.push(latest.image_url);
  }
  return urls;
}

function buildCaption(draft: DraftWithSlides): string {
  return [
    draft.caption ?? "",
    "",
    ((draft.hashtags as string[]) ?? []).join(" "),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

type AttemptOutcome =
  | { ok: true; publishedId: string }
  | { ok: false; error: string };

async function handler(request: NextRequest) {
  // Rate limit by caller IP — even with a valid bearer, a misconfigured
  // cron runner shouldn't stampede. 12/min leaves plenty of headroom for
  // the */5 min schedule + manual retries.
  const ip = ipFromHeaders(request.headers);
  const rl = checkRateLimit({
    key: `cron.publish:${ip}`,
    limit: 12,
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

  const igCredsResult = readCredentials();
  const liCredsResult = readLinkedInCredentials();
  // We let the cron run even when one platform's creds are missing — only
  // rows for that platform get skipped. Returning 503 unless BOTH are
  // missing keeps a partial config (e.g., IG live, LinkedIn pending) from
  // blocking the queue.
  if (!igCredsResult.ok && !liCredsResult.ok) {
    return NextResponse.json(
      {
        error: "no_platform_creds",
        missing: {
          instagram: igCredsResult.ok ? [] : igCredsResult.missing,
          linkedin: liCredsResult.ok ? [] : liCredsResult.missing,
        },
      },
      { status: 503 },
    );
  }
  const creds = igCredsResult.ok ? igCredsResult.creds : null;
  const liCreds = liCredsResult.ok ? liCredsResult.creds : null;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Pick due rows. We filter by scheduled_for <= now in SQL, cap at BATCH_SIZE
  // so a single run never blocks for too long.
  const { data: dueData, error: pickError } = await admin
    .from("scheduled_posts")
    .select("id, draft_id, platform, post_type, scheduled_for, attempt_count")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_SIZE);
  if (pickError) {
    return NextResponse.json({ error: pickError.message }, { status: 500 });
  }
  const due = (dueData ?? []) as ScheduledRow[];
  if (due.length === 0) {
    log.debug("cron.publish", "queue empty");
    return NextResponse.json({ processed: 0, published: 0, failed: 0 });
  }
  log.info("cron.publish", "run started", { dueCount: due.length });

  const summary = {
    processed: 0,
    published: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ scheduledId: string; reason: string }>,
  };

  for (const row of due) {
    summary.processed += 1;

    // TikTok dispatch lands in the next slice; skip cleanly until then.
    if (row.platform === "tiktok") {
      summary.skipped += 1;
      summary.errors.push({
        scheduledId: row.id,
        reason: "platform_unsupported:tiktok",
      });
      continue;
    }

    // Per-platform cred guard. Skip rows whose platform's creds are missing
    // without bumping attempt_count — operators can land creds and the row
    // gets retried on the next tick.
    if (row.platform === "instagram" && !creds) {
      summary.skipped += 1;
      summary.errors.push({
        scheduledId: row.id,
        reason: "platform_creds_missing:instagram",
      });
      continue;
    }
    if (row.platform === "linkedin" && !liCreds) {
      summary.skipped += 1;
      summary.errors.push({
        scheduledId: row.id,
        reason: "platform_creds_missing:linkedin",
      });
      continue;
    }

    const { data: draftData } = await admin
      .from("content_drafts")
      .select(
        "id, caption, hashtags, slides(position, creatives(image_url, version))",
      )
      .eq("id", row.draft_id)
      .maybeSingle();

    if (!draftData) {
      summary.failed += 1;
      summary.errors.push({ scheduledId: row.id, reason: "draft_not_found" });
      continue;
    }

    const draft = draftData as unknown as DraftWithSlides;
    const imageUrls = extractImageUrls(draft);
    // IG carousels need 2+; LinkedIn posts accept 1+ image (or 0 for text).
    const minImages = row.platform === "instagram" ? 2 : 1;
    if (imageUrls.length < minImages) {
      summary.failed += 1;
      summary.errors.push({
        scheduledId: row.id,
        reason: `not_enough_creatives:${imageUrls.length}`,
      });
      await bumpFailure(
        admin,
        row,
        `not_enough_creatives: need ${minImages}+, got ${imageUrls.length}`,
      );
      continue;
    }

    const caption = buildCaption(draft);

    const outcome: AttemptOutcome = await (async () => {
      try {
        if (row.platform === "instagram") {
          const result = await publishCarousel(creds!, imageUrls, caption);
          return { ok: true, publishedId: result.publishedId };
        }
        // linkedin
        const result = await publishCarouselLinkedIn(
          liCreds!,
          imageUrls.slice(0, 9),
          caption,
        );
        return { ok: true, publishedId: result.postUrn };
      } catch (err) {
        if (err instanceof InstagramApiError) {
          return {
            ok: false,
            error: `ig_api:${err.code}:${err.message}`,
          };
        }
        if (err instanceof LinkedInApiError) {
          return {
            ok: false,
            error: `li_api:${err.code}:${err.message}`,
          };
        }
        return {
          ok: false,
          error: err instanceof Error ? err.message : "unknown_error",
        };
      }
    })();

    if (outcome.ok) {
      const { data: published } = await admin
        .from("published_posts")
        .insert({
          draft_id: draft.id,
          platform: row.platform,
          post_type: row.post_type,
          external_id: outcome.publishedId,
        })
        .select("id")
        .single();

      await admin
        .from("scheduled_posts")
        .update({
          status: "published",
          published_post_id: published?.id ?? null,
          last_error: null,
        })
        .eq("id", row.id);
      await admin
        .from("content_drafts")
        .update({ status: "published" })
        .eq("id", draft.id);

      summary.published += 1;
      log.info("cron.publish", "published", {
        scheduledId: row.id,
        draftId: draft.id,
        platform: row.platform,
        externalId: outcome.publishedId,
      });
    } else {
      summary.failed += 1;
      summary.errors.push({ scheduledId: row.id, reason: outcome.error });
      log.warn("cron.publish", "publish failed", {
        scheduledId: row.id,
        draftId: row.draft_id,
        attempt: row.attempt_count + 1,
        reason: outcome.error,
      });
      await bumpFailure(admin, row, outcome.error);
    }
  }

  log.info("cron.publish", "run complete", summary as unknown as Record<string, unknown>);
  return NextResponse.json(summary);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bumpFailure(admin: any, row: ScheduledRow, reason: string) {
  const nextAttempt = row.attempt_count + 1;
  const patch: Record<string, unknown> = {
    attempt_count: nextAttempt,
    last_error: reason.slice(0, 2000),
  };
  if (nextAttempt >= MAX_ATTEMPTS) patch.status = "failed";
  await admin.from("scheduled_posts").update(patch).eq("id", row.id);
}

export { handler as GET, handler as POST };
