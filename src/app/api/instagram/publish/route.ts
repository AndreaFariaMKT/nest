import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { checkCronAuth } from "@/lib/cron-auth";
import {
  publishCarousel,
  readCredentials,
  InstagramApiError,
} from "@/lib/instagram";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Publish a draft as an IG carousel. Bearer-gated with CRON_SECRET so the
 * Vercel cron runner (and manual curl) can hit it without a user session.
 *
 * Request body:
 *   { draftId: string }
 *
 * Response (200):
 *   { publishedId, containerId }
 *
 * 503 when Meta creds aren't configured yet — used as a clean signal that the
 * ANTHROPIC→IG pipeline has a hole that needs credentials, not code.
 */
export async function POST(request: NextRequest) {
  // Rate limit per IP — publishing is rare + heavy, 6/min is plenty for
  // manual retries and blocks runaway loops.
  const ip = ipFromHeaders(request.headers);
  const rl = checkRateLimit({
    key: `ig.publish:${ip}`,
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
    return NextResponse.json({ error: "no CRON_SECRET set" }, { status: 500 });
  }
  if (auth !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const credsResult = readCredentials();
  if (!credsResult.ok) {
    return NextResponse.json(
      { error: "meta_creds_missing", missing: credsResult.missing },
      { status: 503 },
    );
  }
  const creds = credsResult.creds;

  let draftId: string;
  try {
    const body = await request.json();
    draftId = (body?.draftId ?? "").toString();
  } catch {
    return NextResponse.json(
      { error: "invalid_json_body" },
      { status: 400 },
    );
  }
  if (!draftId) {
    return NextResponse.json({ error: "missing_draft_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  type SlideRow = {
    position: number;
    creatives:
      | Array<{ image_url: string; version: number }>
      | { image_url: string; version: number }
      | null;
  };

  const { data: draft } = await admin
    .from("content_drafts")
    .select("id, caption, hashtags, status, slides(position, creatives(image_url, version))")
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) {
    return NextResponse.json({ error: "draft_not_found" }, { status: 404 });
  }

  const slides = (draft.slides ?? []) as SlideRow[];
  const ordered = [...slides].sort((a, b) => a.position - b.position);
  const imageUrls: string[] = [];
  for (const s of ordered) {
    const list = Array.isArray(s.creatives)
      ? s.creatives
      : s.creatives
        ? [s.creatives]
        : [];
    if (list.length === 0) continue;
    const latest = list.sort((a, b) => b.version - a.version)[0];
    imageUrls.push(latest.image_url);
  }
  if (imageUrls.length < 2) {
    return NextResponse.json(
      {
        error: "not_enough_creatives",
        detail: "Instagram carousels need at least 2 slides with rendered creatives.",
        haveCount: imageUrls.length,
      },
      { status: 400 },
    );
  }

  const caption = [
    draft.caption ?? "",
    "",
    ((draft.hashtags as string[]) ?? []).join(" "),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

  try {
    const result = await publishCarousel(creds, imageUrls, caption);

    // Record the publish for analytics / dedupe later.
    await admin.from("published_posts").insert({
      draft_id: draft.id,
      platform: "instagram",
      post_type: "carousel",
      external_id: result.publishedId,
    });
    await admin
      .from("content_drafts")
      .update({ status: "published" })
      .eq("id", draft.id);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InstagramApiError) {
      return NextResponse.json(
        {
          error: "instagram_api_error",
          message: err.message,
          code: err.code,
          type: err.type,
          httpStatus: err.httpStatus,
        },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "publish_failed", message },
      { status: 500 },
    );
  }
}
