// LinkedIn Versioned Posts API wrapper.
//
// Posting flow:
//   1. POST /rest/images?action=initializeUpload  → returns uploadUrl + image URN
//   2. PUT image bytes to uploadUrl                → no body, 201 on success
//   3. POST /rest/posts with all image URNs in `content.multiImage`
//
// LinkedIn requires a versioned `LinkedIn-Version` header on every request to
// the /rest/* surface. We keep the version pinned to a known-good value here;
// it should be reviewed quarterly when LinkedIn deprecates older endpoints.
//
// Auth model (current scaffolding):
//   - LINKEDIN_ACCESS_TOKEN      — long-lived 3-legged token with w_organization_social
//   - LINKEDIN_ORGANIZATION_URN  — author URN, e.g. "urn:li:organization:12345"
//
// A full 3-legged OAuth dance (redirects, refresh) lands later when the
// production app is approved for the Community Management API. For now,
// operators paste a working token + org URN and we handle the publish path.

export const REST_BASE = "https://api.linkedin.com/rest";
/**
 * LinkedIn requires the version pinned per call. They publish a new version
 * monthly and deprecate ~12 months out — keep this value within the
 * supported window. Format: YYYYMM.
 */
export const DEFAULT_API_VERSION = "202403";

// ───────────────────────────────────────────────────────────────────────────
// Credentials
// ───────────────────────────────────────────────────────────────────────────

export type LinkedInCredentials = {
  accessToken: string;
  organizationUrn: string;
  apiVersion: string;
};

export type CredentialsResult =
  | { ok: true; creds: LinkedInCredentials }
  | { ok: false; missing: string[] };

export function readCredentials(
  env: Record<string, string | undefined> = process.env,
): CredentialsResult {
  const missing: string[] = [];
  const accessToken = (env.LINKEDIN_ACCESS_TOKEN ?? "").trim();
  const organizationUrn = (env.LINKEDIN_ORGANIZATION_URN ?? "").trim();
  const apiVersion = (env.LINKEDIN_API_VERSION ?? DEFAULT_API_VERSION).trim();
  if (!accessToken) missing.push("LINKEDIN_ACCESS_TOKEN");
  if (!organizationUrn) missing.push("LINKEDIN_ORGANIZATION_URN");
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, creds: { accessToken, organizationUrn, apiVersion } };
}

export function hasCredentials(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readCredentials(env).ok;
}

// ───────────────────────────────────────────────────────────────────────────
// Pure helpers
// ───────────────────────────────────────────────────────────────────────────

export type ImageRef = { id: string; altText?: string };

export type PostBody = {
  author: string;
  commentary: string;
  visibility: "PUBLIC" | "CONNECTIONS";
  distribution: {
    feedDistribution: "MAIN_FEED";
    targetEntities: never[];
    thirdPartyDistributionChannels: never[];
  };
  content?:
    | { multiImage: { images: ImageRef[] } }
    | { media: { id: string; altText?: string } };
  lifecycleState: "PUBLISHED";
  isReshareDisabledByAuthor: false;
};

/**
 * Build the request body for POST /rest/posts. With 1 image we use the
 * single-media `content.media` shape; with 2-9 images we use `multiImage`.
 * LinkedIn rejects 0 images on a post that has only an image type, so we
 * treat zero-image input as "text-only" (no content key at all).
 */
export function buildPostBody(params: {
  organizationUrn: string;
  caption: string;
  images: ImageRef[];
  visibility?: "PUBLIC" | "CONNECTIONS";
}): PostBody {
  const body: PostBody = {
    author: params.organizationUrn,
    commentary: params.caption,
    visibility: params.visibility ?? "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (params.images.length === 1) {
    body.content = {
      media: { id: params.images[0].id, altText: params.images[0].altText },
    };
  } else if (params.images.length >= 2) {
    // Clamp to LinkedIn's 9-image cap; callers can pre-trim if they prefer.
    body.content = { multiImage: { images: params.images.slice(0, 9) } };
  }
  return body;
}

// ───────────────────────────────────────────────────────────────────────────
// Errors
// ───────────────────────────────────────────────────────────────────────────

export class LinkedInApiError extends Error {
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
    this.name = "LinkedInApiError";
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.raw = params.raw;
  }
}

function buildHeaders(creds: LinkedInCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${creds.accessToken}`,
    "LinkedIn-Version": creds.apiVersion,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

async function parseRestResponse<T>(
  response: Response,
  origin: string,
): Promise<T> {
  // LinkedIn returns 201 + Location header on /posts and /images creation; the
  // body is an empty object. The created URN comes back via headers.
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new LinkedInApiError({
        message: `Non-JSON LinkedIn response (${response.status})`,
        code: "non_json",
        httpStatus: response.status,
        raw: text,
      });
    }
  }
  if (!response.ok) {
    const err = body as { message?: string; serviceErrorCode?: number; status?: number };
    throw new LinkedInApiError({
      message:
        err?.message ?? `LinkedIn ${origin} failed (${response.status})`,
      code: String(err?.serviceErrorCode ?? err?.status ?? "http"),
      httpStatus: response.status,
      raw: body ?? text,
    });
  }
  return body as T;
}

// ───────────────────────────────────────────────────────────────────────────
// Image upload (initialize + PUT bytes)
// ───────────────────────────────────────────────────────────────────────────

export type InitImageUpload = {
  uploadUrl: string;
  imageUrn: string;
};

/**
 * Step 1: register an image upload. The response carries the `uploadUrl` we
 * PUT bytes to and the `image` URN that goes into the post body later.
 */
export async function initializeImageUpload(
  creds: LinkedInCredentials,
): Promise<InitImageUpload> {
  const response = await fetch(`${REST_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: buildHeaders(creds),
    body: JSON.stringify({
      initializeUploadRequest: { owner: creds.organizationUrn },
    }),
  });
  const body = await parseRestResponse<{
    value?: { uploadUrl?: string; image?: string };
  }>(response, "images?action=initializeUpload");
  const uploadUrl = body.value?.uploadUrl;
  const imageUrn = body.value?.image;
  if (!uploadUrl || !imageUrn) {
    throw new LinkedInApiError({
      message: "Init image upload missing uploadUrl or image URN",
      code: "missing_upload_fields",
      httpStatus: response.status,
      raw: body,
    });
  }
  return { uploadUrl, imageUrn };
}

/** Step 2: PUT raw image bytes to the upload URL. No JSON body, no auth header here. */
export async function uploadImageBytes(
  uploadUrl: string,
  bytes: ArrayBuffer | Uint8Array,
): Promise<void> {
  const buffer =
    bytes instanceof Uint8Array
      ? new Blob([new Uint8Array(bytes).buffer as ArrayBuffer])
      : new Blob([bytes]);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: buffer,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new LinkedInApiError({
      message: `Image upload failed (${response.status})`,
      code: "upload_failed",
      httpStatus: response.status,
      raw: text,
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Post creation
// ───────────────────────────────────────────────────────────────────────────

/** Step 3: create the post. LinkedIn returns the created post URN via the
 * `x-restli-id` response header (no body). */
export async function createPost(
  creds: LinkedInCredentials,
  body: PostBody,
): Promise<{ postUrn: string }> {
  const response = await fetch(`${REST_BASE}/posts`, {
    method: "POST",
    headers: buildHeaders(creds),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return parseRestResponse(response, "posts").then(() => {
      throw new LinkedInApiError({
        message: "createPost: unexpectedly OK after parseRestResponse",
        code: "unreachable",
        httpStatus: response.status,
        raw: null,
      });
    });
  }
  const postUrn =
    response.headers.get("x-restli-id") ??
    response.headers.get("X-RestLi-Id") ??
    "";
  if (!postUrn) {
    throw new LinkedInApiError({
      message: "createPost: no x-restli-id header on success",
      code: "missing_post_urn",
      httpStatus: response.status,
      raw: await response.text(),
    });
  }
  return { postUrn };
}

// ───────────────────────────────────────────────────────────────────────────
// Convenience: full publish from image URLs
// ───────────────────────────────────────────────────────────────────────────

/**
 * Fetches each image URL, registers + uploads to LinkedIn, then publishes a
 * single post containing them. Mirrors the IG `publishCarousel` ergonomics.
 *
 * `imageUrls` must be 1–9 (LinkedIn's multi-image cap). Caller is responsible
 * for ensuring the URLs are publicly fetchable; the bytes are streamed
 * through this server, not LinkedIn.
 */
export async function publishCarousel(
  creds: LinkedInCredentials,
  imageUrls: string[],
  caption: string,
): Promise<{ postUrn: string }> {
  if (imageUrls.length < 1 || imageUrls.length > 9) {
    throw new LinkedInApiError({
      message: `LinkedIn posts accept 1–9 images; got ${imageUrls.length}.`,
      code: "image_count_out_of_range",
      httpStatus: 0,
      raw: null,
    });
  }
  const images: ImageRef[] = [];
  for (const url of imageUrls) {
    const init = await initializeImageUpload(creds);
    const sourceResponse = await fetch(url);
    if (!sourceResponse.ok) {
      throw new LinkedInApiError({
        message: `Source image fetch failed (${sourceResponse.status}): ${url}`,
        code: "source_fetch_failed",
        httpStatus: sourceResponse.status,
        raw: null,
      });
    }
    const bytes = new Uint8Array(await sourceResponse.arrayBuffer());
    await uploadImageBytes(init.uploadUrl, bytes);
    images.push({ id: init.imageUrn });
  }
  const body = buildPostBody({
    organizationUrn: creds.organizationUrn,
    caption,
    images,
  });
  return createPost(creds, body);
}
