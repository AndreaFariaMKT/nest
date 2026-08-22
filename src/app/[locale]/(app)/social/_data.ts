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

export interface PieceRecord extends SocialPiece {
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

/** Every piece in the tenant. Screens filter in memory — the sets are small. */
export const listPieces = cache(async (): Promise<PieceRecord[]> => {
  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const { data } = await supabase
    .from("content_drafts")
    .select(PIECE_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("publish_on", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });
  // `content_status` still carries `archived` from before this module existed.
  // Such rows are not part of the pipeline and have no stage colour, so they
  // are dropped here rather than rendering as an unstyled chip on the calendar.
  return ((data ?? []) as unknown as PieceRecord[]).filter((p) =>
    isSocialStage(p.status),
  );
});

export async function getPiece(id: string): Promise<PieceRecord | null> {
  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const { data } = await supabase
    .from("content_drafts")
    .select(PIECE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as PieceRecord | null) ?? null;
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
  pieces: PieceRecord[];
  /** All pieces in the tenant, ignoring the client filter. */
  allPieces: PieceRecord[];
  today: string;
  /** clientId → { name, perCycle }, for the domain helpers. */
  clientIndex: Map<string, { name: string; perCycle: number }>;
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

  return {
    role,
    caps: socialCaps(role),
    clients,
    client,
    pieces: scoped,
    allPieces,
    today: todayIso(),
    clientIndex: new Map(
      clients.map((c) => [c.id, { name: c.name, perCycle: c.posts_per_cycle }]),
    ),
  };
}
