/**
 * Social media module · domain rules.
 *
 * Everything here is pure: no Supabase, no React, no i18n. Pages and server
 * actions read the database and then ask this file what is true — which stage a
 * piece may move to, when a client's reply is due, whether a backlog is thin,
 * and what is waiting on whoever is looking. That keeps the rules in one place
 * and under test.
 *
 * The pipeline, in order:
 *
 *   backlog ──pull──▶ draft ──text──▶ text_review ──direction──▶ creative_review
 *                       ▲                  │                          │
 *                       └───── sent back ──┘                    signed off
 *                                                                     │
 *                                                                     ▼
 *   published ◀── scheduled ◀── approved ◀── client_review ──▶ changes_requested
 *                                                     └─────▶ rejected ──▶ backlog
 *
 * Direction approves the ARGUMENT before anything is drawn, which is the
 * cheapest point to change it. Everything after that is production.
 */

import type { AppRole } from "@/lib/roles";

// ───────────────────────────────────────────────────────────────────────────
// Stages
// ───────────────────────────────────────────────────────────────────────────

export const SOCIAL_STAGES = [
  "backlog",
  "draft",
  "text_review",
  "creative_review",
  "client_review",
  "changes_requested",
  "rejected",
  "approved",
  "scheduled",
  "published",
] as const;

export type SocialStage = (typeof SOCIAL_STAGES)[number];

export const DESIGN_STATES = ["todo", "done", "signed_off"] as const;
export type DesignState = (typeof DESIGN_STATES)[number];

export const CONTENT_ORIGINS = [
  "research",
  "client_request",
  "meeting",
  "follow_up",
  "dated_event",
] as const;
export type ContentOrigin = (typeof CONTENT_ORIGINS)[number];

export const SOCIAL_CHANNELS = ["instagram", "linkedin", "tiktok"] as const;
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

/** Stages that sit inside an open fortnight (someone still owes a move). */
export const IN_FLIGHT_STAGES: SocialStage[] = [
  "draft",
  "text_review",
  "creative_review",
  "client_review",
  "changes_requested",
  "rejected",
  "approved",
];

/** Stages the client is allowed to see at all. */
export const CLIENT_VISIBLE_STAGES: SocialStage[] = [
  "client_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
];

/** Pill tone per stage, so every screen colours a stage the same way. */
export const STAGE_TONE: Record<
  SocialStage,
  "muted" | "brand" | "warning" | "danger" | "success"
> = {
  backlog: "muted",
  draft: "warning",
  text_review: "warning",
  creative_review: "warning",
  client_review: "brand",
  changes_requested: "danger",
  rejected: "danger",
  approved: "success",
  scheduled: "brand",
  published: "success",
};

export function isSocialStage(v: string | null | undefined): v is SocialStage {
  return !!v && (SOCIAL_STAGES as readonly string[]).includes(v);
}

// ───────────────────────────────────────────────────────────────────────────
// Who does what
// ───────────────────────────────────────────────────────────────────────────

/**
 * Responsibilities, not job titles. A login can hold more than one — in a small
 * studio the founder really does approve the text AND run the fortnight, and
 * pretending otherwise leaves half the pipeline with nobody on it.
 */
export const SOCIAL_CAPS = [
  "direction", // approves the text before anything is drawn
  "coordinate", // runs the fortnight: writing, briefs, sign-off, sending
  "design", // produces the pieces
  "publish", // builds the order, schedules, posts
  "client", // reads and approves
] as const;
export type SocialCap = (typeof SOCIAL_CAPS)[number];

const CAPS_BY_ROLE: Record<AppRole, SocialCap[]> = {
  // Direction, and — while the studio is small — coordination and publishing
  // too. "View as" narrows the list when Andréa wants only her own decisions.
  founder: ["direction", "coordinate", "publish"],
  manager: ["coordinate", "publish"],
  social: ["coordinate", "publish"],
  designer_social: ["design"],
  designer_identity: [],
  developer: [],
  accountant: [],
  client: ["client"],
};

export function socialCaps(role: AppRole): SocialCap[] {
  return CAPS_BY_ROLE[role] ?? [];
}

export function hasCap(role: AppRole, cap: SocialCap): boolean {
  return socialCaps(role).includes(cap);
}

/** Does this role reach the module at all? */
export function canUseSocial(role: AppRole): boolean {
  return socialCaps(role).length > 0;
}

/** The module's screens, and who sees each one. */
export const SOCIAL_SCREENS = [
  { key: "overview", href: "/social", caps: ["direction", "coordinate"] },
  { key: "waiting", href: "/social/waiting", caps: [...SOCIAL_CAPS] },
  { key: "backlog", href: "/social/backlog", caps: ["direction", "coordinate"] },
  { key: "fortnight", href: "/social/fortnight", caps: ["direction", "coordinate"] },
  { key: "production", href: "/social/production", caps: ["direction", "coordinate", "design"] },
  { key: "publishing", href: "/social/publishing", caps: ["direction", "coordinate", "publish"] },
  { key: "calendar", href: "/social/calendar", caps: ["direction", "coordinate", "design", "publish"] },
  { key: "media", href: "/social/media", caps: ["direction", "coordinate", "design"] },
  { key: "logins", href: "/social/logins", caps: ["direction", "coordinate", "publish"] },
  { key: "report", href: "/social/report", caps: ["direction", "coordinate"] },
] as const satisfies readonly {
  key: string;
  href: string;
  caps: readonly SocialCap[];
}[];

export function socialScreensFor(role: AppRole): { key: string; href: string }[] {
  const caps = socialCaps(role);
  return SOCIAL_SCREENS.filter((s) =>
    s.caps.some((c) => caps.includes(c)),
  ).map(({ key, href }) => ({ key, href }));
}

// ───────────────────────────────────────────────────────────────────────────
// Dates · plain YYYY-MM-DD arithmetic, UTC-safe (no timezone drift)
// ───────────────────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(v: string | null | undefined): v is string {
  return !!v && ISO_DATE.test(v);
}

function toUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The studio's calendar day. Everything the module reasons about — reply dates,
 * "is this overdue", which cell the calendar highlights — is a calendar day in
 * Brazil, not a UTC instant. Reading `toISOString()` would roll the day over at
 * 21:00 local, flipping a client's piece to "reply passed" three hours before
 * their day ended.
 */
export const STUDIO_TIMEZONE = "America/Sao_Paulo";

// en-CA formats as YYYY-MM-DD, which is the shape the whole module speaks.
const studioDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: STUDIO_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayIso(now: Date = new Date()): string {
  return studioDay.format(now);
}

/**
 * The calendar day a timestamp fell on, in the studio's timezone. Use this for
 * every timestamptz the UI shows as a date — `.slice(0, 10)` reports work done
 * at 21:30 as having happened tomorrow.
 */
export function dayOf(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? null : studioDay.format(d);
}

/** Difference in whole days, `b - a`. Negative when b is before a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

function isWeekend(d: Date): boolean {
  const wd = d.getUTCDay();
  return wd === 0 || wd === 6;
}

/** Step `count` working days forward (positive) or back (negative). */
export function addWorkingDays(iso: string, count: number): string {
  const step = count < 0 ? -1 : 1;
  let left = Math.abs(count);
  const d = toUTC(iso);
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    if (!isWeekend(d)) left -= 1;
  }
  return toIsoDate(d);
}

/**
 * How long the client gets. A piece reaches them five working days before it
 * publishes, and that date is the reply date — silence past it means the piece
 * runs as scheduled, so one quiet week never stalls the calendar.
 */
export const REPLY_WORKING_DAYS = 5;

export function replyDueBy(publishOn: string | null | undefined): string | null {
  if (!isIsoDate(publishOn)) return null;
  return addWorkingDays(publishOn, -REPLY_WORKING_DAYS);
}

export function isReplyOverdue(
  publishOn: string | null | undefined,
  today: string,
): boolean {
  const due = replyDueBy(publishOn);
  return due !== null && due < today;
}

// ───────────────────────────────────────────────────────────────────────────
// The fortnight
// ───────────────────────────────────────────────────────────────────────────

/**
 * The alternation the whole module runs on: a sending week, then a production
 * week. Weeks are counted from this Monday, so changing it shifts every
 * fortnight boundary at once.
 */
export const FORTNIGHT_ANCHOR = "2026-01-05";

export interface Fortnight {
  /** Monday of the sending week. */
  start: string;
  /** Friday of the production week. */
  end: string;
  /** Wednesday of the sending week — when the plan should be with clients. */
  sendingWeekEnd: string;
}

/** Monday of the ISO week containing `iso`. */
export function weekStart(iso: string): string {
  const d = toUTC(iso);
  const wd = d.getUTCDay(); // 0 = Sunday
  const back = wd === 0 ? 6 : wd - 1;
  return addDays(iso, -back);
}

/**
 * The fortnight `iso` falls in, anchored to a known sending-week Monday so the
 * alternation stays stable across months. Weeks are counted from the anchor.
 */
export function fortnightOf(iso: string, anchorMonday: string): Fortnight {
  const monday = weekStart(iso);
  const weeks = Math.floor(daysBetween(weekStart(anchorMonday), monday) / 7);
  // A negative week index still has to land on the sending week of its pair.
  const offset = ((weeks % 2) + 2) % 2;
  const start = addDays(monday, -offset * 7);
  return {
    start,
    end: addDays(start, 11), // Monday → the Friday eleven days later
    sendingWeekEnd: addDays(start, 2), // Wednesday: approval cut
  };
}

// ───────────────────────────────────────────────────────────────────────────
// The piece
// ───────────────────────────────────────────────────────────────────────────

export interface SocialPiece {
  id: string;
  client_id: string;
  title: string;
  status: SocialStage;
  design_state: DesignState;
  pillar: string | null;
  caption: string | null;
  why_now: string | null;
  material_url: string | null;
  client_comment: string | null;
  publish_on: string | null;
  publish_time: string;
  direction_ok: boolean;
  post_type: string | null;
  slide_count: number | null;
  channels: SocialChannel[];
  origin: ContentOrigin | null;
  backlog_added_on: string;
}

/** "Carousel · 5", "Single post", "Reel" — the format as a person says it. */
export function formatLabel(
  postType: string | null,
  slideCount: number | null,
  label: (key: string) => string,
): string {
  if (!postType) return label("unset");
  const base = label(postType);
  return postType === "carousel" && slideCount ? `${base} · ${slideCount}` : base;
}

// ───────────────────────────────────────────────────────────────────────────
// Transitions
// ───────────────────────────────────────────────────────────────────────────

export const SOCIAL_ACTIONS = [
  "pull",
  "send_text_up",
  "direction_approve",
  "direction_reject",
  "set_design_state",
  "send_to_client",
  "client_approve",
  "client_request_changes",
  "client_reject",
  "approve_on_silence",
  "reopen_to_design",
  "return_to_backlog",
  "queue",
  "mark_live",
  "unmark_live",
] as const;
export type SocialAction = (typeof SOCIAL_ACTIONS)[number];

export type Verdict =
  | { ok: true; next: SocialStage }
  | { ok: false; reason: string };

/**
 * Every refusal this module can produce. Kept as a list so the UI can tell a
 * known reason (translate it) from a Postgres error (show it verbatim rather
 * than swallowing a real failure behind a friendly noise word).
 */
export const BLOCKED_REASONS = [
  "notOnShelf",
  "notInWriting",
  "needsText",
  "notWithDirection",
  "needsDirectionNote",
  "notInDesign",
  "needsSignOff",
  "needsMaterial",
  "notWithClient",
  "needsClientNote",
  "needsRejectReason",
  "notInChanges",
  "notReturnable",
  "notOverdue",
  "needsMaterialToSend",
  "writeBlocked",
  "notApproved",
  "notScheduled",
  "notLive",
  "notYours",
  "signOffNotYours",
  "notFound",
  "unknownAction",
  "nothingToSave",
  "nothingSignedOff",
  "nothingApproved",
  "needsClient",
  "needsTitle",
  "needsWhyNow",
  "needsTitleAndLink",
  "needsCapturedOn",
  "needsAccountAndUser",
  "noSecretKey",
  "noPassword",
  "secretUnreadable",
  "notOnLogin",
] as const;

export type BlockedReason = (typeof BLOCKED_REASONS)[number];

export function isBlockedReason(v: string): v is BlockedReason {
  return (BLOCKED_REASONS as readonly string[]).includes(v);
}

const ACTION_CAP: Record<SocialAction, SocialCap[]> = {
  pull: ["coordinate"],
  send_text_up: ["coordinate"],
  direction_approve: ["direction"],
  direction_reject: ["direction"],
  set_design_state: ["design", "coordinate"],
  send_to_client: ["coordinate"],
  client_approve: ["client"],
  client_request_changes: ["client"],
  client_reject: ["client"],
  approve_on_silence: ["coordinate"],
  reopen_to_design: ["coordinate"],
  return_to_backlog: ["coordinate", "direction"],
  queue: ["coordinate", "publish"],
  mark_live: ["coordinate", "publish"],
  unmark_live: ["coordinate", "publish"],
};

export function actionAllowedForRole(
  action: SocialAction,
  role: AppRole,
): boolean {
  const caps = socialCaps(role);
  return ACTION_CAP[action].some((c) => caps.includes(c));
}

/**
 * May this action run against this piece right now? The `reason` is an i18n key
 * under `social.blocked.*` — every refusal says what is missing, because "no"
 * without a reason is how a queue stalls.
 */
export function canRun(
  action: SocialAction,
  piece: Pick<
    SocialPiece,
    "status" | "design_state" | "caption" | "material_url" | "publish_on"
  >,
  opts: { comment?: string; today?: string } = {},
): Verdict {
  const hasText = !!piece.caption && piece.caption.trim().length > 0;
  const comment = (opts.comment ?? "").trim();
  const today = opts.today ?? todayIso();

  switch (action) {
    case "pull":
      return piece.status === "backlog"
        ? { ok: true, next: "draft" }
        : { ok: false, reason: "notOnShelf" };

    case "send_text_up":
      if (piece.status !== "draft") return { ok: false, reason: "notInWriting" };
      if (!hasText) return { ok: false, reason: "needsText" };
      return { ok: true, next: "text_review" };

    case "direction_approve":
      return piece.status === "text_review"
        ? { ok: true, next: "creative_review" }
        : { ok: false, reason: "notWithDirection" };

    case "direction_reject":
      if (piece.status !== "text_review")
        return { ok: false, reason: "notWithDirection" };
      if (!comment) return { ok: false, reason: "needsDirectionNote" };
      return { ok: true, next: "draft" };

    case "set_design_state":
      return piece.status === "creative_review"
        ? { ok: true, next: "creative_review" }
        : { ok: false, reason: "notInDesign" };

    case "send_to_client":
      if (piece.status !== "creative_review")
        return { ok: false, reason: "notInDesign" };
      if (piece.design_state !== "signed_off")
        return { ok: false, reason: "needsSignOff" };
      // Sign-off can happen and the link be cleared afterwards, so the guard is
      // repeated at the door rather than trusted from earlier in the flow.
      if (!piece.material_url?.trim())
        return { ok: false, reason: "needsMaterialToSend" };
      return { ok: true, next: "client_review" };

    case "client_approve":
      return piece.status === "client_review" ||
        piece.status === "changes_requested"
        ? { ok: true, next: "approved" }
        : { ok: false, reason: "notWithClient" };

    case "client_request_changes":
      if (piece.status !== "client_review" && piece.status !== "changes_requested")
        return { ok: false, reason: "notWithClient" };
      if (!comment) return { ok: false, reason: "needsClientNote" };
      return { ok: true, next: "changes_requested" };

    case "client_reject":
      if (piece.status !== "client_review" && piece.status !== "changes_requested")
        return { ok: false, reason: "notWithClient" };
      if (!comment) return { ok: false, reason: "needsRejectReason" };
      return { ok: true, next: "rejected" };

    case "approve_on_silence":
      // The module's promise to the studio: silence past the reply date means
      // the piece runs as scheduled. Without this the only way out of
      // client_review is the client, and a client who never logs in freezes the
      // calendar.
      if (piece.status !== "client_review")
        return { ok: false, reason: "notWithClient" };
      if (!isReplyOverdue(piece.publish_on, today))
        return { ok: false, reason: "notOverdue" };
      return { ok: true, next: "approved" };

    case "reopen_to_design":
      return piece.status === "changes_requested"
        ? { ok: true, next: "creative_review" }
        : { ok: false, reason: "notInChanges" };

    case "return_to_backlog":
      return piece.status === "rejected" || piece.status === "changes_requested"
        ? { ok: true, next: "backlog" }
        : { ok: false, reason: "notReturnable" };

    case "queue":
      return piece.status === "approved"
        ? { ok: true, next: "scheduled" }
        : { ok: false, reason: "notApproved" };

    case "mark_live":
      return piece.status === "scheduled" || piece.status === "approved"
        ? { ok: true, next: "published" }
        : { ok: false, reason: "notScheduled" };

    case "unmark_live":
      return piece.status === "published"
        ? { ok: true, next: "scheduled" }
        : { ok: false, reason: "notLive" };
  }
}

/** Marking design done without a folder link produces a piece nobody can find. */
export function canSetDesignState(
  piece: Pick<SocialPiece, "status" | "material_url">,
  next: DesignState,
): Verdict {
  const base = canRun("set_design_state", {
    ...piece,
    design_state: "todo",
    caption: null,
    publish_on: null,
  });
  if (!base.ok) return base;
  if (next !== "todo" && !piece.material_url?.trim()) {
    return { ok: false, reason: "needsMaterial" };
  }
  return { ok: true, next: "creative_review" };
}

// ───────────────────────────────────────────────────────────────────────────
// Backlog stock · the only number anyone has to watch
// ───────────────────────────────────────────────────────────────────────────

export interface Stock {
  count: number;
  perCycle: number;
  /** How many fortnights the shelf covers. */
  fortnights: number;
  low: boolean;
  critical: boolean;
}

export function backlogStock(count: number, perCycle: number): Stock {
  const per = Math.max(1, perCycle);
  const fortnights = count / per;
  return {
    count,
    perCycle: per,
    fortnights,
    low: fortnights < 2,
    critical: fortnights < 1,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Client health
// ───────────────────────────────────────────────────────────────────────────

export type HealthLevel = "ok" | "warn" | "bad";

export interface ClientHealth {
  level: HealthLevel;
  /** i18n key under social.health.* */
  reason: string;
  count: number;
  stock: Stock;
  withClient: number;
  live: number;
  returned: number;
  overdue: number;
}

export function clientHealth(
  pieces: Pick<SocialPiece, "status" | "caption" | "publish_on">[],
  perCycle: number,
  today: string,
): ClientHealth {
  const backlog = pieces.filter((p) => p.status === "backlog").length;
  const stock = backlogStock(backlog, perCycle);
  const returned = pieces.filter(
    (p) => p.status === "changes_requested" || p.status === "rejected",
  ).length;
  const unwritten = pieces.filter(
    (p) => p.status === "draft" && !p.caption?.trim(),
  ).length;
  const withClient = pieces.filter((p) => p.status === "client_review").length;
  const live = pieces.filter((p) => p.status === "published").length;
  const overdue = pieces.filter(
    (p) =>
      (p.status === "client_review" || p.status === "changes_requested") &&
      isReplyOverdue(p.publish_on, today),
  ).length;

  // Worst-first: a passed reply date outranks a thin shelf.
  let level: HealthLevel = "ok";
  let reason = "onRhythm";
  let count = 0;
  if (stock.low) {
    level = "warn";
    reason = "stockLow";
  }
  if (unwritten) {
    level = "warn";
    reason = "unwritten";
    count = unwritten;
  }
  if (returned) {
    level = "bad";
    reason = "returned";
    count = returned;
  }
  if (overdue) {
    level = "bad";
    reason = "replyOverdue";
    count = overdue;
  }
  if (stock.critical) {
    level = "bad";
    reason = "stockCritical";
    count = 0;
  }

  return { level, reason, count, stock, withClient, live, returned, overdue };
}

// ───────────────────────────────────────────────────────────────────────────
// Waiting on you
// ───────────────────────────────────────────────────────────────────────────

export interface WaitingEntry {
  /** Null for entries that point at a client rather than one piece. */
  id: string | null;
  clientId: string;
  title: string;
  /** i18n key under social.waiting.reasons.* */
  reason: string;
  /** Interpolation for the reason line. */
  values?: Record<string, string | number>;
}

export interface WaitingInput {
  pieces: SocialPiece[];
  /** clientId → { name, perCycle } */
  clients: Map<string, { name: string; perCycle: number }>;
  today: string;
}

/**
 * What each responsibility currently owes. Built from caps, not job titles, so
 * a login that both coordinates and publishes gets one merged list instead of
 * having to remember which hat to put on.
 */
export function waitingFor(
  caps: SocialCap[],
  { pieces, clients, today }: WaitingInput,
): WaitingEntry[] {
  const out: WaitingEntry[] = [];
  const push = (
    p: SocialPiece,
    reason: string,
    values?: Record<string, string | number>,
  ) => out.push({ id: p.id, clientId: p.client_id, title: p.title, reason, values });

  if (caps.includes("direction")) {
    for (const p of pieces.filter((x) => x.status === "text_review")) {
      push(p, "approveText", { client: clients.get(p.client_id)?.name ?? "" });
    }
    for (const p of pieces.filter((x) => x.status === "rejected")) {
      push(p, "decideRejected");
    }
  }

  if (caps.includes("coordinate")) {
    for (const p of pieces.filter(
      (x) => x.status === "draft" && !!x.caption?.trim(),
    )) {
      push(p, "sendTextUp");
    }
    for (const p of pieces.filter(
      (x) => x.status === "draft" && !x.caption?.trim(),
    )) {
      push(p, "stillToWrite", { date: p.publish_on ?? "" });
    }
    for (const p of pieces.filter(
      (x) => x.status === "creative_review" && x.design_state === "done",
    )) {
      push(p, "signOffArt");
    }
    for (const p of pieces.filter(
      (x) => x.status === "creative_review" && x.design_state === "signed_off",
    )) {
      push(p, "sendToClient");
    }
    for (const p of pieces.filter((x) => x.status === "changes_requested")) {
      push(p, "backToDesign");
    }
    for (const [clientId, c] of clients) {
      const stock = backlogStock(
        pieces.filter((p) => p.client_id === clientId && p.status === "backlog")
          .length,
        c.perCycle,
      );
      if (stock.low) {
        out.push({
          id: null,
          clientId,
          title: c.name,
          reason: "restock",
          values: { fortnights: stock.fortnights.toFixed(1) },
        });
      }
    }
  }

  if (caps.includes("design")) {
    for (const p of pieces.filter(
      (x) => x.status === "creative_review" && x.design_state !== "signed_off",
    )) {
      push(p, p.design_state === "todo" ? "toDraw" : "drawnAwaitingSignOff", {
        date: p.publish_on ?? "",
      });
    }
  }

  if (caps.includes("publish")) {
    for (const p of pieces.filter((x) => x.status === "approved")) {
      push(p, "notInOrder");
    }
    for (const p of pieces.filter((x) => x.status === "scheduled")) {
      push(p, "toSchedule", {
        date: p.publish_on ?? "",
        time: (p.publish_time ?? "").slice(0, 5),
      });
    }
  }

  if (caps.includes("client")) {
    for (const p of pieces.filter(
      (x) => x.status === "client_review" || x.status === "changes_requested",
    )) {
      push(
        p,
        isReplyOverdue(p.publish_on, today) ? "replyPassed" : "replyBy",
        {
          due: replyDueBy(p.publish_on) ?? "",
          date: p.publish_on ?? "",
        },
      );
    }
  }

  return out;
}
