import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { checkCronAuth } from "@/lib/cron-auth";
import {
  fetchPostMetrics,
  InstagramApiError,
  readCredentials,
} from "@/lib/instagram";
import { log } from "@/lib/log";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
// Each post costs two Graph API calls, so a full batch is well past the 10s
// default before any of it is Supabase's fault.
export const maxDuration = 60;

/**
 * Daily cron — pulls post-level metrics for every recent Instagram
 * `published_post` and writes a `post_metrics` row (time-series).
 *
 * Per run:
 *   1. Find the IG posts in the LOOKBACK_DAYS window that have gone longest
 *      without a snapshot, up to BATCH_SIZE rows — so coverage rotates and
 *      every post is reached within ceil(total / BATCH_SIZE) days.
 *   2. For each: call IG Graph API for likes/comments + insights (reach,
 *      saves, shares, views, total_interactions).
 *   3. Insert one row in `post_metrics` per post — every run produces a new
 *      time-series snapshot, even if the values haven't changed (consumers
 *      decide how to dedupe).
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`. Returns 503 with the missing
 * env list when Meta creds aren't configured. LinkedIn/TikTok rows are
 * silently skipped (their wrappers come in Sprint 11-12).
 */

const BATCH_SIZE = 50;
const LOOKBACK_DAYS = 90;

type Admin = ReturnType<typeof createAdminClient>;

async function handler(request: NextRequest) {
  const ip = ipFromHeaders(request.headers);
  const rl = checkRateLimit({
    key: `cron.metrics-collect:${ip}`,
    limit: 6,
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

  const credsResult = readCredentials();
  if (!credsResult.ok) {
    log.warn("cron.metrics-collect", "missing env", {
      missing: credsResult.missing,
    });
    return NextResponse.json(
      { error: "meta_creds_missing", missing: credsResult.missing },
      { status: 503 },
    );
  }
  const creds = credsResult.creds;

  const admin: Admin = createAdminClient();

  const lookbackIso = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Least-recently-captured first (migration 028), not newest-published first.
  // The old ordering re-picked the same newest BATCH_SIZE rows on every run, so
  // once a tenant had more than that inside the lookback window — one client
  // publishing four times a week reaches it in three months — every post past
  // the batch stopped accumulating metrics for good, and the report measured a
  // sample that shrank as the studio published more.
  const { data: posts } = await admin.rpc("stale_metrics_posts", {
    platform_name: "instagram",
    lookback_ts: lookbackIso,
    batch: BATCH_SIZE,
  });

  const summary = {
    candidates: posts?.length ?? 0,
    captured: 0,
    skipped: 0,
    failed: 0,
  };

  for (const post of (posts ?? []) as Array<{
    id: string;
    external_id: string;
  }>) {
    try {
      const metrics = await fetchPostMetrics(creds, post.external_id);
      const { error } = await admin.from("post_metrics").insert({
        published_post_id: post.id,
        impressions: metrics.impressions,
        reach: metrics.reach,
        likes: metrics.likes,
        comments: metrics.comments,
        saves: metrics.saves,
        shares: metrics.shares,
        raw: {
          ...metrics.raw,
          totalInteractions: metrics.totalInteractions,
        },
      });
      if (error) {
        summary.failed += 1;
        log.error("cron.metrics-collect", "metrics_insert_failed", {
          postId: post.id,
          message: error.message,
        });
        continue;
      }
      summary.captured += 1;
    } catch (err) {
      // 100 / OAuthException for revoked permissions, 190 for token expired,
      // 400 for unsupported metric on media type — log + count, never fatal.
      if (err instanceof InstagramApiError) {
        if (err.code === "non_existing" || err.httpStatus === 404) {
          summary.skipped += 1;
          log.warn("cron.metrics-collect", "post_unavailable", {
            postId: post.id,
            httpStatus: err.httpStatus,
          });
          continue;
        }
        summary.failed += 1;
        log.error("cron.metrics-collect", "ig_error", {
          postId: post.id,
          code: err.code,
          httpStatus: err.httpStatus,
          fbtrace: err.fbtrace,
        });
        continue;
      }
      summary.failed += 1;
      log.error("cron.metrics-collect", "unknown_error", {
        postId: post.id,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({ ok: true, summary });
}

export { handler as GET, handler as POST };
