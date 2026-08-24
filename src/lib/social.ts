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

/**
 * Stages a piece can only be in because a client has seen it.
 *
 * `client_review` is what is with them now; the other three are the three
 * answers. Used by the feedback screen, which until now read only the content
 * engine's `approvals` table and so showed no client response from this module
 * at all — the one screen a designer has for hearing back.
 */
export const CLIENT_DECIDED_STAGES = [
  "client_review",
  "changes_requested",
  "rejected",
  "approved",
] as const;

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
  // Coordinate only. Everything else in this list is about producing a post;
  // this one is about what the platform may publish AS, and the result of
  // getting it wrong is public and permanent.
  { key: "accounts", href: "/social/accounts", caps: ["coordinate"] },
  { key: "report", href: "/social/report", caps: ["direction", "coordinate"] },
  // These two live outside /social because the app already had them, and one
  // meeting record per client is not a social-media-only idea. They are in the
  // module's nav because that is where the people running a fortnight look for
  // them.
  { key: "meetings", href: "/meetings", caps: ["direction", "coordinate"] },
  {
    key: "messages",
    href: "/messages",
    caps: ["direction", "coordinate", "design", "publish"],
  },
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

/**
 * The studio's offset from UTC, as a fixed string.
 *
 * Brazil has observed no daylight saving since 2019, so this is a constant and
 * not a lie. Written as an offset rather than computed, because the one place
 * it is used builds an instant from a date and a time the studio typed — and a
 * literal with an offset is unambiguous in a way `new Date(y, m, d)` (which
 * reads the SERVER's timezone, not the studio's) is not.
 */
export const STUDIO_UTC_OFFSET = "-03:00";

/**
 * The instant a piece publishes, from the day and time the studio chose.
 *
 * `publish_on` is a calendar day and `publish_time` is a wall-clock time —
 * together they mean "08:00 in São Paulo", and the publishing queue stores a
 * timestamptz. This is the only place in the module where those two
 * representations meet, and getting it wrong by three hours would publish a
 * piece the evening before its date.
 *
 * Returns null when there is no date: a piece with no publish_on is not
 * scheduled for anything, and inventing an instant for it would be worse than
 * refusing.
 */
export function publishInstant(
  publishOn: string | null | undefined,
  publishTime: string | null | undefined,
): string | null {
  if (!publishOn || !isIsoDate(publishOn)) return null;
  // publish_time arrives as "08:00:00" from Postgres and "08:00" from a form.
  const raw = (publishTime ?? "08:00").trim();
  const m = /^(\d{2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const at = new Date(
    `${publishOn}T${m[1]}:${m[2]}:00${STUDIO_UTC_OFFSET}`,
  );
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

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
 * The last N complete months, newest first, as {year, month} in the studio's
 * calendar — never the running one.
 *
 * The monthly report is a closed-month artifact: the studio's own rhythm is to
 * send it between the 3rd and the 7th, about the month that just ended. The
 * button that generates it had year and month hardcoded to today, so on any
 * day but the last it produced a partial month, and on the 3rd — the day the
 * report is actually written — it could not reach August at all.
 *
 * Derived from the studio's calendar day rather than the server's: reading
 * `new Date().getMonth()` on a UTC host flips the month three hours early, so
 * a report generated late on the 31st would be filed under the next month.
 */
export function recentMonths(
  count = 12,
  today: string = todayIso(),
): { year: number; month: number }[] {
  const [y, m] = today.split("-").map((n) => Number.parseInt(n, 10));
  const out: { year: number; month: number }[] = [];
  // Start at the previous month: the running one is not finished, and a
  // report about a month still in progress is a number that will change.
  let year = m === 1 ? y - 1 : y;
  let month = m === 1 ? 12 : m - 1;
  for (let i = 0; i < count; i++) {
    out.push({ year, month });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return out;
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

/**
 * Working days between pulling a theme off the shelf and its publish date.
 *
 * Named here because it was written twice as a bare `10` — once as the server
 * default in `pullFromBacklog` and once as the form's pre-fill — so changing
 * the lead time in one place made the form quietly disagree with the server.
 * It is a default, not a rule: the date is editable on the way in.
 */
export const PULL_LEAD_WORKING_DAYS = 10;

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

/**
 * A stored YYYY-MM-DD as a person reads it. Every screen goes through this, so
 * a date does not change shape depending on which one you are looking at.
 * Timezone is pinned because the value is already a calendar day, not an
 * instant — letting the runtime localise it would shift it by a day.
 */
export function formatIsoDate(
  iso: string | null | undefined,
  locale: string,
): string | null {
  if (!isIsoDate(iso)) return null;
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
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
  | { ok: false; reason: BlockedReason };

/**
 * Every refusal this module can produce.
 *
 * Kept as a closed list so the UI can translate a known reason instead of
 * guessing. Database failures do NOT arrive here — they come through
 * `DB_ERRORS` in src/lib/db-error.ts, keyed by SQLSTATE, because a raw
 * Postgres message carries table, column and constraint names and the portal
 * renders these refusals for clients. Both sets render under `social.blocked`.
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
  "needsPlatform",
  "needsAccountRef",
  "needsToken",
  "needsArtworkFiles",
  "tooManyArtworkFiles",
  "artworkWrongType",
  "artworkTooLarge",
  "artworkUploadFailed",
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
// Available moves
// ───────────────────────────────────────────────────────────────────────────

export type MoveTone = "primary" | "secondary" | "danger";

export interface Move {
  action: SocialAction;
  tone: MoveTone;
  /** canRun refuses this action without a comment, so the form must ask. */
  needsComment: boolean;
}

export interface MoveSet {
  moves: Move[];
  /**
   * i18n key under social.waitingOn.*, set when the reader has nothing to do
   * but knows who does. Null when they simply have no business here.
   */
  waitingOn:
    | "direction"
    | "design"
    | "client"
    | "order"
    | "writing"
    /** The piece is finished. Nobody is holding it. */
    | "done"
    /** Someone can move it — just not this reader. */
    | "notYours"
    | null;
}

/**
 * The one answer to "what happens next, for this person, on this piece".
 *
 * Two screens render this — the fortnight board and the piece record — and
 * while it was written twice they disagreed in four places: one offered a queue
 * button the other did not, one offered "send text up" on a piece with no text
 * and earned a refusal, one pre-filled the client's words and the other threw
 * them away. Deriving both from here makes that class of drift impossible
 * rather than merely unlikely.
 */
export function movesFor(
  piece: Pick<
    SocialPiece,
    "status" | "design_state" | "caption" | "material_url" | "publish_on"
  >,
  caps: SocialCap[],
  today: string = todayIso(),
): MoveSet {
  const has = (c: SocialCap) => caps.includes(c);
  // `none` used to be `waitingOn: null`, which the UI renders as nothing at
  // all — so a designer opening a piece they drew, that has since gone live,
  // got a section headed "Próximo passo" containing an empty box. Absence of
  // UI is not an explanation. A piece with no move for this reader is in one
  // of two states, and they mean different things.
  const none: MoveSet = { moves: [], waitingOn: "notYours" };
  const finished: MoveSet = { moves: [], waitingOn: "done" };
  const one = (
    action: SocialAction,
    tone: MoveTone = "primary",
    needsComment = false,
  ): MoveSet => ({ moves: [{ action, tone, needsComment }], waitingOn: null });

  switch (piece.status) {
    case "backlog":
      return has("coordinate") ? one("pull") : none;

    case "draft":
      if (!has("coordinate")) return { moves: [], waitingOn: "writing" };
      // Offering this with no text only earns a `needsText` refusal.
      return piece.caption?.trim()
        ? one("send_text_up")
        : { moves: [], waitingOn: "writing" };

    case "text_review":
      if (!has("direction")) return { moves: [], waitingOn: "direction" };
      return {
        moves: [
          { action: "direction_reject", tone: "danger", needsComment: true },
          { action: "direction_approve", tone: "primary", needsComment: false },
        ],
        waitingOn: null,
      };

    case "creative_review":
      if (has("coordinate") && piece.design_state === "signed_off") {
        return one("send_to_client");
      }
      return { moves: [], waitingOn: "design" };

    case "client_review":
      if (has("client")) {
        return {
          moves: [
            { action: "client_reject", tone: "danger", needsComment: true },
            {
              action: "client_request_changes",
              tone: "secondary",
              needsComment: true,
            },
            { action: "client_approve", tone: "primary", needsComment: false },
          ],
          waitingOn: null,
        };
      }
      // Past the reply date the studio may move it on; before that the
      // client's window is theirs.
      if (has("coordinate") && isReplyOverdue(piece.publish_on, today)) {
        return one("approve_on_silence");
      }
      return { moves: [], waitingOn: "client" };

    case "changes_requested":
      if (has("client")) {
        return {
          moves: [
            { action: "client_approve", tone: "primary", needsComment: false },
          ],
          waitingOn: null,
        };
      }
      return has("coordinate")
        ? one("reopen_to_design")
        : { moves: [], waitingOn: "design" };

    case "rejected":
      return has("coordinate") || has("direction")
        ? one("return_to_backlog", "primary", false)
        : none;

    case "approved":
      return has("publish") || has("coordinate")
        ? one("queue")
        : { moves: [], waitingOn: "order" };

    case "scheduled":
      return has("publish") || has("coordinate") ? one("mark_live") : none;

    case "published":
      return has("publish") || has("coordinate")
        ? one("unmark_live", "secondary")
        : finished;
  }
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

/**
 * NOTE ON THE NAME: `perCycle` is read from `clients.posts_per_cycle`, and this
 * module reads it as publications per FORTNIGHT. `src/lib/cycles.ts` uses
 * "cycle" to mean a calendar month for billing and task rhythm — the two ideas
 * do not interact, but the shared word on one column is a trap. Anything else
 * wiring to that column should assume fortnights, not months.
 */
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

export type HealthLevel = "new" | "ok" | "warn" | "bad";

export type HealthReason =
  | "neverStocked"
  | "onRhythm"
  | "stockLow"
  | "stockCritical"
  | "unwritten"
  | "returned"
  | "replyOverdue";

export interface ClientHealth {
  level: HealthLevel;
  /** i18n key under social.health.* */
  reason: HealthReason;
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

  // A client with nothing at all is not in trouble, it is new. This used to
  // fall straight through to `stockCritical`, so onboarding three clients
  // painted three red cards saying the backlog was below one fortnight —
  // before anyone had had a chance to do anything wrong. An alarm colour
  // spent on the expected state stops meaning anything by the second week.
  if (pieces.length === 0) {
    return {
      level: "new",
      reason: "neverStocked",
      count: 0,
      stock,
      withClient,
      live,
      returned,
      overdue,
    };
  }

  // Worst-first: a passed reply date outranks a thin shelf.
  let level: HealthLevel = "ok";
  let reason: HealthReason = "onRhythm";
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

export type WaitingReason =
  | "approveText"
  | "decideRejected"
  | "sendTextUp"
  | "stillToWrite"
  | "signOffArt"
  | "sendToClient"
  | "backToDesign"
  | "restock"
  | "toDraw"
  | "drawnAwaitingSignOff"
  | "notInOrder"
  | "toSchedule"
  | "replyBy"
  | "replyPassed";

export interface WaitingEntry {
  /** Null for entries that point at a client rather than one piece. */
  id: string | null;
  clientId: string;
  title: string;
  /** i18n key under social.waiting.reasons.* */
  reason: WaitingReason;
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
    reason: WaitingReason,
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
          // A number, not a string. toFixed(1) produced "1.5", which landed
          // inside Portuguese copy as "backlog em 1.5 quinzenas" — a Brazilian
          // writes 1,5. Handing ICU a number lets it format per locale, and
          // keeps decimal separators out of a module that has no locale.
          values: { fortnights: Math.round(stock.fortnights * 10) / 10 },
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

/**
 * The module's screens as the sidebar renders them.
 *
 * Same list, same caps, one omission: `messages`. Every role that holds a
 * social cap already carries Messages in its own sidebar group (NAV_BY_ROLE),
 * so repeating it as a sub-item would be the same link twice in one column.
 *
 * `meetings` left too, once NAV gained an entry for it — it stayed here only
 * because this list was the only path to /meetings in the whole app.
 */
/**
 * May this role open this path inside the module?
 *
 * Nav is nav — a link that is not rendered is not a permission. Every screen
 * here declares who it is for, and until now only /social/accounts acted on
 * that: the middleware let any role holding ANY social capability into the
 * whole /social prefix, so a designer who typed /social/backlog read every
 * client's shelf, /social/publishing the whole order, /social/logins the
 * shared accounts. The per-screen `caps.includes` calls dotted around the
 * pages only hide buttons.
 *
 * Derived from SOCIAL_SCREENS rather than restated, so a screen added without
 * a thought about who may see it is denied rather than open.
 *
 * `base` is locale-stripped and query-stripped, as the middleware produces it.
 */
export function canReachSocialPath(role: AppRole, base: string): boolean {
  const caps = socialCaps(role);
  if (caps.length === 0) return false;

  // A piece record is not a screen in this list. It renders per-capability
  // panels of its own and is the destination of links on screens each role
  // legitimately reaches, so it is open to anyone the module admits.
  if (base === "/social/pieces" || base.startsWith("/social/pieces/")) {
    return true;
  }

  // Exact first. The overview's href is "/social", which is a prefix of every
  // other screen in the list — matching on prefix alone answered "overview"
  // for /social/waiting and judged it by the wrong screen's capabilities.
  const screen =
    SOCIAL_SCREENS.find((candidate) => candidate.href === base) ??
    SOCIAL_SCREENS.find(
      (candidate) =>
        candidate.href !== "/social" && base.startsWith(`${candidate.href}/`),
    );
  // An unlisted path under /social is not a screen anyone has been granted.
  if (!screen) return false;
  return screen.caps.some((c) => caps.includes(c));
}

/**
 * Where to send a role that reached a module screen it may not see.
 *
 * Their own first screen, not /today: being bounced out of the module for
 * opening one wrong page reads as losing access to all of it. Every role with
 * a social capability holds `waiting`, so this is never empty for anyone this
 * function is asked about.
 */
export function firstSocialScreen(role: AppRole): string {
  return socialScreensFor(role)[0]?.href ?? "/today";
}

export function socialSidebarScreens(
  role: AppRole,
): { key: string; href: string }[] {
  // Both now have their own sidebar entries, in the group where people
  // actually look for them. Repeating them under the module would be the same
  // link twice in one column.
  const elsewhere = new Set(["messages", "meetings"]);
  return socialScreensFor(role).filter((s) => !elsewhere.has(s.key));
}
