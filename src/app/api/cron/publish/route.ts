import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.gen";

import { checkCronAuth } from "@/lib/cron-auth";
import { publishCarousel, InstagramApiError } from "@/lib/instagram";
import {
  publishCarousel as publishCarouselLinkedIn,
  LinkedInApiError,
} from "@/lib/linkedin";
import { publishVideo as publishTikTokVideo, TikTokApiError } from "@/lib/tiktok";
import {
  accountIndex,
  accountKey,
  resolveAccount,
  type SocialAccountRow,
} from "@/lib/social-accounts";
import { log } from "@/lib/log";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createAdminClient>;

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
 * SCHEDULE — `10 11 * * *` in vercel.json, i.e. 08:10 in São Paulo, ten
 * minutes past the module's default publish time. Once a day is the Vercel
 * Hobby plan's ceiling, and it is the reason `publish_time` is honoured to
 * within a window rather than to the minute: this run takes everything whose
 * scheduled_for has passed, so a piece set for the afternoon waits for the
 * next morning. Moving to a Pro plan and an hourly schedule (`10 * * * *`)
 * makes the chosen time close to exact; nothing in the code changes.
 * src/app/[locale]/(app)/social/_components/ArtworkPanel.tsx tells the studio
 * this, so the interface does not imply a precision the schedule lacks.
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
  title: string;
  caption: string | null;
  hashtags: string[];
  video_url: string | null;
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

  const auth = checkCronAuth(request.headers.get("authorization"));
  if (auth === "unset") {
    return NextResponse.json({ error: "no_cron_secret" }, { status: 500 });
  }
  if (auth !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();


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

  // Every account that could serve this batch, fetched once. The batch is at
  // most BATCH_SIZE rows, so this is one query rather than up to ten.
  const { data: accountData } = await admin
    .from("client_social_accounts")
    .select(
      "client_id, platform, account_ref, secret_enc, api_version, publish_mode, enabled",
    );
  // Deliberately NOT filtered on `enabled`. Filtering here would remove a
  // switched-off account from the index entirely, so resolveAccount would
  // report `no_account` for it — and telling "never registered" apart from
  // "registered but switched off" is the whole reason that module returns six
  // distinct problems instead of null. The classification belongs to the one
  // place that can explain itself.
  const accounts = accountIndex((accountData ?? []) as SocialAccountRow[]);

  const summary = {
    processed: 0,
    published: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ scheduledId: string; reason: string }>,
  };

  for (const row of due) {
    summary.processed += 1;

    const { data: draftData } = await admin
      .from("content_drafts")
      .select(
        "id, client_id, title, caption, hashtags, video_url, slides(position, creatives(image_url, version))",
      )
      .eq("id", row.draft_id)
      .maybeSingle();

    if (!draftData) {
      summary.failed += 1;
      summary.errors.push({ scheduledId: row.id, reason: "draft_not_found" });
      continue;
    }

    // Which account this piece publishes as, decided by the piece's own client.
    //
    // This is the guard that used to be PUBLISH_ENABLED_CLIENT_ID, and before
    // that was nothing at all: the credentials were one set for the whole
    // deployment, so a second client's approved carousel would have gone live
    // on the FIRST client's feed — publicly, irreversibly, under the wrong
    // brand. Now a piece can only publish through a credential registered
    // against, and enabled for, its own client.
    //
    // Every refusal here is a skip, not a failure: attempt_count is untouched,
    // so landing a credential lets the waiting rows go out on the next tick
    // instead of arriving already out of retries. The reason is specific
    // enough to act on — "not_enabled" and "no_secret" are different jobs.
    const resolved = resolveAccount(
      accounts.get(accountKey(draftData.client_id, row.platform)),
    );
    if (!resolved.ok) {
      summary.skipped += 1;
      summary.errors.push({
        scheduledId: row.id,
        reason: `account_${resolved.problem}:${row.platform}`,
      });
      continue;
    }

    const draft = draftData as unknown as DraftWithSlides;
    const caption = buildCaption(draft);

    // TikTok needs a video URL, not slide images. Validate per-platform.
    if (row.platform === "tiktok") {
      if (!draft.video_url) {
        summary.failed += 1;
        summary.errors.push({
          scheduledId: row.id,
          reason: "tiktok_missing_video_url",
        });
        await bumpFailure(admin, row, "tiktok_missing_video_url");
        continue;
      }
    } else {
      const imageUrls = extractImageUrls(draft);
      // IG carousels need 2+; LinkedIn posts accept 1+ image.
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
    }

    const outcome: AttemptOutcome = await (async () => {
      try {
        // Branching on `resolved`, not on `row.platform`. They agree by
        // construction — the account was looked up with row.platform as part
        // of the key — but `resolved` is a discriminated union, so this way
        // the compiler is the thing guaranteeing that Instagram credentials
        // never reach the LinkedIn call. A mis-paired credential here is a
        // post on the wrong network, which is the whole point of this change.
        switch (resolved.platform) {
          case "instagram": {
            const result = await publishCarousel(
              resolved.creds,
              extractImageUrls(draft),
              caption,
            );
            return { ok: true, publishedId: result.publishedId };
          }
          case "linkedin": {
            const result = await publishCarouselLinkedIn(
              resolved.creds,
              extractImageUrls(draft).slice(0, 9),
              caption,
            );
            return { ok: true, publishedId: result.postUrn };
          }
          case "tiktok": {
            const result = await publishTikTokVideo(
              resolved.creds,
              draft.video_url!,
              { title: draft.title },
            );
            return { ok: true, publishedId: result.publishId };
          }
        }
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
        if (err instanceof TikTokApiError) {
          return {
            ok: false,
            error: `tt_api:${err.code}:${err.message}`,
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
        // published_at, not just the status. The monthly report counts a
        // month's pieces by `published_at` range — marking a piece live by
        // hand set it, this path never did, so every piece the cron posted
        // was missing from the client's own report and from its pillar mix.
        .update({ status: "published", published_at: new Date().toISOString() })
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
async function bumpFailure(admin: Admin, row: ScheduledRow, reason: string) {
  const nextAttempt = row.attempt_count + 1;
  const patch: Database["public"]["Tables"]["scheduled_posts"]["Update"] = {
    attempt_count: nextAttempt,
    last_error: reason.slice(0, 2000),
  };
  if (nextAttempt >= MAX_ATTEMPTS) patch.status = "failed";
  await admin.from("scheduled_posts").update(patch).eq("id", row.id);
}

export { handler as GET, handler as POST };
