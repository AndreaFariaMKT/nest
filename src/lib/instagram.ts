// Instagram Graph API wrapper (v21.0).
//
// Only used server-side — never expose the access token to the browser.
//
// Required env:
//   META_LONG_LIVED_TOKEN          — long-lived page access token (60-day)
//   INSTAGRAM_BUSINESS_ACCOUNT_ID  — IG Business account id (not the page id)
//
// Optional env (API version override):
//   META_GRAPH_API_VERSION (default: "v21.0")

export const DEFAULT_API_VERSION = "v21.0";
export const GRAPH_BASE = "https://graph.facebook.com";

// ───────────────────────────────────────────────────────────────────────────
// Env guard
// ───────────────────────────────────────────────────────────────────────────

export type IgCredentials = {
  token: string;
  igBusinessAccountId: string;
  apiVersion: string;
};

export type CredentialsResult =
  | { ok: true; creds: IgCredentials }
  | { ok: false; missing: string[] };

export function readCredentials(
  env: Record<string, string | undefined> = process.env,
): CredentialsResult {
  const missing: string[] = [];
  const token = (env.META_LONG_LIVED_TOKEN ?? "").trim();
  const igId = (env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? "").trim();
  const apiVersion = (env.META_GRAPH_API_VERSION ?? DEFAULT_API_VERSION).trim();
  if (!token) missing.push("META_LONG_LIVED_TOKEN");
  if (!igId) missing.push("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, creds: { token, igBusinessAccountId: igId, apiVersion } };
}

export function hasCredentials(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readCredentials(env).ok;
}

// ───────────────────────────────────────────────────────────────────────────
// URL builders (pure)
// ───────────────────────────────────────────────────────────────────────────

export function buildMediaUrl(creds: IgCredentials): string {
  return `${GRAPH_BASE}/${creds.apiVersion}/${creds.igBusinessAccountId}/media`;
}

export function buildPublishUrl(creds: IgCredentials): string {
  return `${GRAPH_BASE}/${creds.apiVersion}/${creds.igBusinessAccountId}/media_publish`;
}

export function buildContainerUrl(
  creds: IgCredentials,
  containerId: string,
): string {
  return `${GRAPH_BASE}/${creds.apiVersion}/${containerId}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Errors
// ───────────────────────────────────────────────────────────────────────────

export class InstagramApiError extends Error {
  readonly code: string;
  readonly type: string;
  readonly subcode: number | null;
  readonly httpStatus: number;
  readonly fbtrace: string | null;
  readonly raw: unknown;

  constructor(params: {
    message: string;
    code: string;
    type: string;
    subcode: number | null;
    httpStatus: number;
    fbtrace: string | null;
    raw: unknown;
  }) {
    super(params.message);
    this.name = "InstagramApiError";
    this.code = params.code;
    this.type = params.type;
    this.subcode = params.subcode;
    this.httpStatus = params.httpStatus;
    this.fbtrace = params.fbtrace;
    this.raw = params.raw;
  }
}

type GraphError = {
  error?: {
    message?: string;
    type?: string;
    code?: number | string;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new InstagramApiError({
      message: `Non-JSON response from Graph API (${response.status})`,
      code: "non_json",
      type: "client",
      subcode: null,
      httpStatus: response.status,
      fbtrace: null,
      raw: text,
    });
  }
  if (!response.ok || (body && typeof body === "object" && "error" in body)) {
    const err = (body as GraphError).error ?? {};
    throw new InstagramApiError({
      message: err.message ?? `Graph API error (${response.status})`,
      code: String(err.code ?? "unknown"),
      type: err.type ?? "api",
      subcode: err.error_subcode ?? null,
      httpStatus: response.status,
      fbtrace: err.fbtrace_id ?? null,
      raw: body,
    });
  }
  return body as T;
}

// ───────────────────────────────────────────────────────────────────────────
// Endpoints
// ───────────────────────────────────────────────────────────────────────────

/** Create a single carousel item container (one slide). */
export async function createCarouselItem(
  creds: IgCredentials,
  imageUrl: string,
): Promise<{ id: string }> {
  const url = buildMediaUrl(creds);
  const params = new URLSearchParams({
    image_url: imageUrl,
    is_carousel_item: "true",
    access_token: creds.token,
  });
  const response = await fetch(`${url}?${params.toString()}`, {
    method: "POST",
  });
  return parseResponse<{ id: string }>(response);
}

/** Create the parent carousel container referencing N item container ids. */
export async function createCarousel(
  creds: IgCredentials,
  childrenIds: string[],
  caption: string,
): Promise<{ id: string }> {
  if (childrenIds.length < 2 || childrenIds.length > 10) {
    throw new Error(
      `Instagram carousels require 2–10 children; got ${childrenIds.length}.`,
    );
  }
  const url = buildMediaUrl(creds);
  const params = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childrenIds.join(","),
    caption,
    access_token: creds.token,
  });
  const response = await fetch(`${url}?${params.toString()}`, {
    method: "POST",
  });
  return parseResponse<{ id: string }>(response);
}

export type ContainerStatus =
  | "EXPIRED"
  | "ERROR"
  | "FINISHED"
  | "IN_PROGRESS"
  | "PUBLISHED";

/** Poll container status — carousel media takes seconds to process. */
export async function getContainerStatus(
  creds: IgCredentials,
  containerId: string,
): Promise<{ status_code: ContainerStatus; id: string }> {
  const url = buildContainerUrl(creds, containerId);
  const params = new URLSearchParams({
    fields: "status_code",
    access_token: creds.token,
  });
  const response = await fetch(`${url}?${params.toString()}`);
  return parseResponse<{ status_code: ContainerStatus; id: string }>(response);
}

/** Publish a ready container. Returns the published media id. */
export async function publish(
  creds: IgCredentials,
  containerId: string,
): Promise<{ id: string }> {
  const url = buildPublishUrl(creds);
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: creds.token,
  });
  const response = await fetch(`${url}?${params.toString()}`, {
    method: "POST",
  });
  return parseResponse<{ id: string }>(response);
}

/**
 * Wait for a container to reach FINISHED (polls every `intervalMs`).
 * Throws on EXPIRED/ERROR or when the total wait exceeds `timeoutMs`.
 */
export async function waitForContainerReady(
  creds: IgCredentials,
  containerId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const intervalMs = opts.intervalMs ?? 3_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await getContainerStatus(creds, containerId);
    if (result.status_code === "FINISHED" || result.status_code === "PUBLISHED") {
      return;
    }
    if (result.status_code === "ERROR" || result.status_code === "EXPIRED") {
      throw new InstagramApiError({
        message: `Container status ${result.status_code}`,
        code: "container_status",
        type: "client",
        subcode: null,
        httpStatus: 0,
        fbtrace: null,
        raw: result,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new InstagramApiError({
    message: `Container did not reach FINISHED within ${timeoutMs}ms`,
    code: "timeout",
    type: "client",
    subcode: null,
    httpStatus: 0,
    fbtrace: null,
    raw: null,
  });
}

/**
 * Convenience: create all children → create carousel → wait → publish.
 * Returns the published media id.
 */
export async function publishCarousel(
  creds: IgCredentials,
  imageUrls: string[],
  caption: string,
): Promise<{ publishedId: string; containerId: string }> {
  const children = await Promise.all(
    imageUrls.map((url) => createCarouselItem(creds, url)),
  );
  const carousel = await createCarousel(
    creds,
    children.map((c) => c.id),
    caption,
  );
  await waitForContainerReady(creds, carousel.id);
  const published = await publish(creds, carousel.id);
  return { publishedId: published.id, containerId: carousel.id };
}
