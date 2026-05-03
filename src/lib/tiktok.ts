// TikTok Content Posting API wrapper.
//
// Two upload paths:
//   1. PULL_FROM_URL — TikTok fetches the video from a URL we provide. The
//      URL's domain must be on the verified domains list in the TikTok
//      developer portal. This is the cheap path: one round-trip.
//   2. FILE_UPLOAD — chunked upload from our server. Used when the source
//      isn't on a verified domain. Not implemented here yet — Supabase
//      Storage URLs aren't on TikTok's verified domains by default, so
//      operators MUST verify their domain before this lib can publish.
//
// Status: Direct Post (`/v2/post/publish/video/init/`) requires the dev app
// to have completed Audit + been granted the `video.publish` scope. Apps in
// review can use the Inbox endpoint
// (`/v2/post/publish/inbox/video/init/`) which sends drafts to the
// creator's TikTok app for manual finalisation. We pin to the Inbox path
// during v1 — operators graduate to direct post by flipping
// TIKTOK_PUBLISH_MODE=direct once their app is audited.

export const TIKTOK_BASE = "https://open.tiktokapis.com/v2";

// ───────────────────────────────────────────────────────────────────────────
// Credentials
// ───────────────────────────────────────────────────────────────────────────

export type TikTokCredentials = {
  accessToken: string;
  /** "inbox" (default, no audit needed) or "direct" (post-audit). */
  publishMode: "inbox" | "direct";
};

export type CredentialsResult =
  | { ok: true; creds: TikTokCredentials }
  | { ok: false; missing: string[] };

export function readCredentials(
  env: Record<string, string | undefined> = process.env,
): CredentialsResult {
  const missing: string[] = [];
  const accessToken = (env.TIKTOK_ACCESS_TOKEN ?? "").trim();
  if (!accessToken) missing.push("TIKTOK_ACCESS_TOKEN");
  if (missing.length > 0) return { ok: false, missing };
  const rawMode = (env.TIKTOK_PUBLISH_MODE ?? "inbox").trim().toLowerCase();
  const publishMode: "inbox" | "direct" = rawMode === "direct" ? "direct" : "inbox";
  return { ok: true, creds: { accessToken, publishMode } };
}

export function hasCredentials(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readCredentials(env).ok;
}

// ───────────────────────────────────────────────────────────────────────────
// Init body builders (pure)
// ───────────────────────────────────────────────────────────────────────────

export type PrivacyLevel =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY";

export type PostInfo = {
  title?: string;
  /** Required for `direct` mode; ignored for `inbox`. */
  privacyLevel?: PrivacyLevel;
  disableDuet?: boolean;
  disableComment?: boolean;
  disableStitch?: boolean;
  /** Frame to use as cover; defaults to the first frame. */
  videoCoverTimestampMs?: number;
};

export type InitBody = {
  post_info?: {
    title?: string;
    privacy_level?: PrivacyLevel;
    disable_duet?: boolean;
    disable_comment?: boolean;
    disable_stitch?: boolean;
    video_cover_timestamp_ms?: number;
  };
  source_info: {
    source: "PULL_FROM_URL";
    video_url: string;
  };
};

/**
 * Build the request body for the init endpoint when pulling from a URL.
 * `direct` mode requires a privacy_level; `inbox` mode doesn't (drafts
 * inherit privacy from the user's manual finalisation step), so we silently
 * drop the privacy_level for inbox to keep the body minimal.
 */
export function buildInitBody(params: {
  videoUrl: string;
  postInfo?: PostInfo;
  publishMode: "inbox" | "direct";
}): InitBody {
  const body: InitBody = {
    source_info: {
      source: "PULL_FROM_URL",
      video_url: params.videoUrl,
    },
  };
  const post = params.postInfo;
  if (!post) return body;

  const includePrivacy = params.publishMode === "direct";
  const postInfo: NonNullable<InitBody["post_info"]> = {};
  if (post.title) postInfo.title = post.title;
  if (includePrivacy && post.privacyLevel) {
    postInfo.privacy_level = post.privacyLevel;
  }
  if (typeof post.disableDuet === "boolean") postInfo.disable_duet = post.disableDuet;
  if (typeof post.disableComment === "boolean")
    postInfo.disable_comment = post.disableComment;
  if (typeof post.disableStitch === "boolean")
    postInfo.disable_stitch = post.disableStitch;
  if (typeof post.videoCoverTimestampMs === "number") {
    postInfo.video_cover_timestamp_ms = post.videoCoverTimestampMs;
  }
  if (Object.keys(postInfo).length > 0) body.post_info = postInfo;
  return body;
}

// ───────────────────────────────────────────────────────────────────────────
// Errors
// ───────────────────────────────────────────────────────────────────────────

export class TikTokApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly raw: unknown;

  constructor(params: {
    message: string;
    code: string;
    httpStatus: number;
    raw: unknown;
  }) {
    super(params.message);
    this.name = "TikTokApiError";
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.raw = params.raw;
  }
}

function buildHeaders(creds: TikTokCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${creds.accessToken}`,
    "Content-Type": "application/json; charset=UTF-8",
  };
}

async function parseTtResponse<T>(
  response: Response,
  origin: string,
): Promise<T> {
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new TikTokApiError({
      message: `Non-JSON TikTok response (${response.status})`,
      code: "non_json",
      httpStatus: response.status,
      raw: text,
    });
  }
  // TikTok wraps errors under `error.code` even on 2xx ("ok" → success;
  // anything else is an error even with HTTP 200).
  const ttError = (body as { error?: { code?: string; message?: string } })
    .error;
  if (!response.ok || (ttError && ttError.code && ttError.code !== "ok")) {
    throw new TikTokApiError({
      message:
        ttError?.message ?? `TikTok ${origin} failed (${response.status})`,
      code: ttError?.code ?? `http_${response.status}`,
      httpStatus: response.status,
      raw: body,
    });
  }
  return body as T;
}

// ───────────────────────────────────────────────────────────────────────────
// IO — init + status
// ───────────────────────────────────────────────────────────────────────────

export type InitResponse = {
  publishId: string;
};

export function initEndpoint(publishMode: "inbox" | "direct"): string {
  return publishMode === "direct"
    ? `${TIKTOK_BASE}/post/publish/video/init/`
    : `${TIKTOK_BASE}/post/publish/inbox/video/init/`;
}

export async function initVideoUpload(
  creds: TikTokCredentials,
  body: InitBody,
): Promise<InitResponse> {
  const response = await fetch(initEndpoint(creds.publishMode), {
    method: "POST",
    headers: buildHeaders(creds),
    body: JSON.stringify(body),
  });
  const parsed = await parseTtResponse<{
    data?: { publish_id?: string };
  }>(response, "init");
  const publishId = parsed.data?.publish_id;
  if (!publishId) {
    throw new TikTokApiError({
      message: "init: missing publish_id in response",
      code: "missing_publish_id",
      httpStatus: response.status,
      raw: parsed,
    });
  }
  return { publishId };
}

export type PublishStatus =
  | "PROCESSING_DOWNLOAD"
  | "PROCESSING_UPLOAD"
  | "PROCESSING_COMPLETE"
  | "PUBLISH_COMPLETE"
  | "FAILED";

export async function fetchPublishStatus(
  creds: TikTokCredentials,
  publishId: string,
): Promise<{ status: PublishStatus; failReason?: string }> {
  const response = await fetch(`${TIKTOK_BASE}/post/publish/status/fetch/`, {
    method: "POST",
    headers: buildHeaders(creds),
    body: JSON.stringify({ publish_id: publishId }),
  });
  const parsed = await parseTtResponse<{
    data?: { status?: string; fail_reason?: string };
  }>(response, "status/fetch");
  return {
    status: (parsed.data?.status ?? "PROCESSING_DOWNLOAD") as PublishStatus,
    failReason: parsed.data?.fail_reason,
  };
}

/**
 * Poll the publish status until it terminates (PUBLISH_COMPLETE for direct,
 * PROCESSING_COMPLETE for inbox — at which point the user finalises in the
 * TikTok app), or FAILED. Throws on FAILED or timeout.
 */
export async function waitForPublishReady(
  creds: TikTokCredentials,
  publishId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<PublishStatus> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 4_000;
  const terminal =
    creds.publishMode === "direct"
      ? new Set<PublishStatus>(["PUBLISH_COMPLETE"])
      : new Set<PublishStatus>([
          "PROCESSING_COMPLETE",
          "PUBLISH_COMPLETE",
        ]);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await fetchPublishStatus(creds, publishId);
    if (terminal.has(result.status)) return result.status;
    if (result.status === "FAILED") {
      throw new TikTokApiError({
        message: `Publish failed: ${result.failReason ?? "unknown"}`,
        code: "publish_failed",
        httpStatus: 0,
        raw: result,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new TikTokApiError({
    message: `Publish did not terminate within ${timeoutMs}ms`,
    code: "timeout",
    httpStatus: 0,
    raw: null,
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Convenience — full publish from a single video URL
// ───────────────────────────────────────────────────────────────────────────

/**
 * Init + wait. Returns the TikTok publish_id which doubles as the external
 * id we store on `published_posts.external_id` for cross-referencing with
 * the metrics API later.
 */
export async function publishVideo(
  creds: TikTokCredentials,
  videoUrl: string,
  postInfo?: PostInfo,
): Promise<{ publishId: string; status: PublishStatus }> {
  const init = await initVideoUpload(
    creds,
    buildInitBody({ videoUrl, postInfo, publishMode: creds.publishMode }),
  );
  const status = await waitForPublishReady(creds, init.publishId);
  return { publishId: init.publishId, status };
}
