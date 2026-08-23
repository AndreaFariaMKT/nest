/**
 * Server-side loading for the social media module.
 *
 * Every screen needs the same three things — who is looking, which clients are
 * in scope, and the pieces that belong to them — so they are loaded once here
 * and cached per request. Nothing in this file decides anything; the rules live
 * in src/lib/social.ts.
 */

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { getCurrentRole } from "@/lib/roles-server";
import type { AppRole } from "@/lib/roles";
import {
  isSocialStage,
  socialCaps,
  todayIso,
  type SocialCap,
  type SocialPiece,
} from "@/lib/social";

export interface SocialClient {
  id: string;
  slug: string;
  name: string;
  industry: string | null;
  /** Publications per FORTNIGHT — see the note on backlogStock(). */
  posts_per_cycle: number;
}

/** The columns every screen reads. Kept in one place so they never drift. */
export const PIECE_COLUMNS =
  "id, client_id, title, status, design_state, pillar, caption, why_now, " +
  "material_url, note_design, note_publish, design_feedback, client_comment, " +
  "return_reason, publish_on, publish_time, direction_ok, post_type, " +
  "slide_count, channels, origin, backlog_added_on, window_note, source_ref, " +
  "sent_up_at, approved_internal_at, sent_to_client_at, client_approved_at, " +
  "published_at, updated_at";

/**
 * What the PORTAL may read. Deliberately not PIECE_COLUMNS: that list carries
 * note_design, note_publish, design_feedback and return_reason — internal
 * production talk ABOUT this client. A React client component serializes the
 * props object as passed, not as typed, so handing it a full row ships every
 * one of those columns into the client's browser. Migration 022 closed the
 * row-level version of this hole; this is the column-level one.
 */
export const PORTAL_PIECE_COLUMNS =
  "id, client_id, title, status, design_state, pillar, caption, why_now, " +
  "client_comment, publish_on, publish_time, direction_ok, post_type, " +
  "slide_count, channels, origin, material_url, backlog_added_on, " +
  "sent_to_client_at, published_at, updated_at";

export interface SocialPieceRow extends SocialPiece {
  note_design: string | null;
  note_publish: string | null;
  design_feedback: string | null;
  return_reason: string | null;
  window_note: string | null;
  source_ref: string | null;
  sent_up_at: string | null;
  approved_internal_at: string | null;
  sent_to_client_at: string | null;
  client_approved_at: string | null;
  published_at: string | null;
  updated_at: string;
}

/** Clients with the social module switched on, for the active tenant. */
export const listSocialClients = cache(async (): Promise<SocialClient[]> => {
  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const { data } = await supabase
    .from("clients")
    .select("id, slug, name, industry, posts_per_cycle")
    .eq("tenant_id", tenantId)
    .eq("social_enabled", true)
    .neq("status", "archived")
    .order("name");
  return (data ?? []) as SocialClient[];
});

/**
 * How many rows one PostgREST response can carry. Declared in
 * supabase/config.toml as `max_rows = 1000`, and the same on Supabase hosted.
 * A request for more is not an error — it is silently served this many.
 */
const PAGE = 1000;

/** Refuse to loop forever if the cap ever changes underneath us. */
const MAX_PAGES = 20;

/**
 * Every piece in the tenant. Screens filter in memory rather than per-screen in
 * SQL, which is fine to a few thousand pieces per tenant — past that the right
 * answer is a query per screen with a real WHERE clause, not a bigger page.
 *
 * Paged rather than fetched in one shot, because a plain select stopped at
 * PostgREST's cap and said nothing about it — and the truncation order was the
 * worst possible one. The sort is `publish_on ASC NULLS LAST`, and backlog
 * themes are exactly the rows with no publish date, so the shelf was the FIRST
 * thing to disappear: /social/backlog would empty, `backlogStock` would report
 * `critical`, and every client dot on /social would turn red, with no error
 * anywhere to explain it.
 */
export const listPieces = cache(async (): Promise<SocialPieceRow[]> => {
  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const rows: SocialPieceRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("content_drafts")
      .select(PIECE_COLUMNS)
      // content_drafts carries two workflows over one status column. Without
      // this every content-engine draft shows up here as unstarted social work.
      .eq("engine", "social")
      .eq("tenant_id", tenantId)
      .order("publish_on", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      // `id` breaks ties: without a unique tiebreaker two rows sharing a
      // publish_on and updated_at can order differently between pages, which
      // is how a paged read silently drops one row and repeats another.
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) break;
    const batch = (data ?? []) as unknown as SocialPieceRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  // `content_status` still carries `archived` from before this module existed.
  // Such rows are not part of the pipeline and have no stage colour, so they
  // are dropped here rather than rendering as an unstyled chip on the calendar.
  return rows.filter((p) => isSocialStage(p.status));
});

export async function getPiece(id: string): Promise<SocialPieceRow | null> {
  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const { data } = await supabase
    .from("content_drafts")
    .select(PIECE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as SocialPieceRow | null) ?? null;
}

/**
 * What one screen sees: the role's responsibilities, the client filter, and the
 * pieces that survive it.
 */
export interface SocialScope {
  role: AppRole;
  caps: SocialCap[];
  clients: SocialClient[];
  /** Null when the filter is "all clients". */
  client: SocialClient | null;
  pieces: SocialPieceRow[];
  /** All pieces in the tenant, ignoring the client filter. */
  allPieces: SocialPieceRow[];
  today: string;
  /** clientId → { name, perCycle }, for the domain helpers. */
  clientIndex: Map<string, { name: string; perCycle: number }>;
  /** Every screen needs this; it was a linear scan in seven of them. */
  clientName: (id: string) => string;
}

/**
 * Resolve `?client=` — accepts a slug (what the URL shows) or an id (what a
 * link from another screen carries). An unknown value falls back to all
 * clients rather than an empty screen.
 */
export async function loadScope(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<SocialScope> {
  const [params, role, clients, allPieces] = await Promise.all([
    searchParams,
    getCurrentRole(),
    listSocialClients(),
    listPieces(),
  ]);

  const raw = params.client;
  const wanted = Array.isArray(raw) ? raw[0] : raw;
  const client =
    clients.find((c) => c.slug === wanted || c.id === wanted) ?? null;

  const scoped = client
    ? allPieces.filter((p) => p.client_id === client.id)
    : allPieces.filter((p) => clients.some((c) => c.id === p.client_id));

  const clientIndex = new Map(
    clients.map((c) => [c.id, { name: c.name, perCycle: c.posts_per_cycle }]),
  );

  return {
    role,
    caps: socialCaps(role),
    clients,
    client,
    pieces: scoped,
    allPieces,
    today: todayIso(),
    clientIndex,
    clientName: (id) => clientIndex.get(id)?.name ?? "—",
  };
}
