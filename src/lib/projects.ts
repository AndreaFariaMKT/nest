/**
 * Projects — the layer between a client and the work.
 *
 * A client runs several engagements at once, each with its own type, scope,
 * team, dates and money. Before this, tasks hung straight off the client, so
 * "which website build is this for" had no answer, and the two routes named
 * after projects (/identity-projects, /website-builds) were views over
 * brand_kits and clients because there was no table to read.
 *
 * Kept free of Supabase types on purpose: the vocabulary and the derived
 * numbers are the part worth testing, and importing generated types here would
 * make them untestable without a database.
 */

/** The seven the studio sells. Order is the order they appear in the picker. */
export const PROJECT_TYPES = [
  "brand",
  "visual_identity",
  "website",
  "launch",
  "hub",
  "seo",
  "social_media",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_STATUSES = [
  "negotiating",
  "active",
  "paused",
  "done",
  "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function isProjectType(v: string | null | undefined): v is ProjectType {
  return !!v && (PROJECT_TYPES as readonly string[]).includes(v);
}

export function isProjectStatus(
  v: string | null | undefined,
): v is ProjectStatus {
  return !!v && (PROJECT_STATUSES as readonly string[]).includes(v);
}

/**
 * Counts toward "projetos ativos" on the leadership block.
 *
 * `paused` deliberately does not: a paused engagement is not being worked and
 * counting it inflates the only number on that card that is supposed to say
 * how much is in flight.
 */
export function isActiveStatus(status: string): boolean {
  return status === "active";
}

/** Counts toward "projetos em negociação". */
export function isNegotiatingStatus(status: string): boolean {
  return status === "negotiating";
}

export type ProjectProgress = {
  total: number;
  done: number;
  /** 0–100, rounded. 0 when there are no tasks at all. */
  percent: number;
  open: number;
};

/**
 * Progress of a project from its task statuses.
 *
 * A project with no tasks reports 0%, not 100%. Dividing by zero would give
 * NaN and the obvious guard — "no tasks means nothing left to do" — puts a
 * full bar on an engagement nobody has started, which is the most misleading
 * thing this number could say.
 */
/**
 * The same figure as `projectProgress`, from counts the database did.
 *
 * A project with no row at all has no tasks, which reports 0% — not 100%, for
 * the reason `projectProgress` gives: a full bar on an engagement nobody has
 * started is the most misleading thing this number could say.
 */
export function progressOf(
  counted: { total: number; done: number } | undefined,
): ProjectProgress {
  const total = counted?.total ?? 0;
  const done = counted?.done ?? 0;
  return {
    total,
    done,
    open: total - done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export function projectProgress(
  statuses: readonly string[],
): ProjectProgress {
  const total = statuses.length;
  const done = statuses.filter((s) => s === "done").length;
  return {
    total,
    done,
    open: total - done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/**
 * Whether a project is late: it has an end date, that date has passed, and it
 * is not finished. Compared as ISO day strings in the studio's calendar —
 * `ends_on` is a date column precisely so this does not become a timezone
 * question.
 */
export function isLate(
  project: { ends_on: string | null; status: string },
  todayIso: string,
): boolean {
  if (!project.ends_on) return false;
  if (project.status === "done" || project.status === "cancelled") return false;
  return project.ends_on < todayIso;
}

/** Client work vs the studio's own. A null client is internal. */
export function isInternal(project: { client_id: string | null }): boolean {
  return project.client_id === null;
}

/**
 * What an engagement costs to deliver, and what is left.
 *
 * A cost is either a fixed amount or a share of the contract passed through to
 * a supplier — 050's CHECK refuses a row that sets both or neither, because
 * that is the state that makes the total unanswerable.
 *
 * The percentage is resolved against the project's own value, so a project
 * with no value recorded cannot resolve one: those are counted separately
 * rather than treated as zero. A margin that silently ignores half its costs
 * is worse than a margin that says it is incomplete.
 */
export type ProjectCost = {
  amount_cents: number | null;
  percent_passed: number | null;
};

export type CostSummary = {
  total_cents: number;
  /** Costs expressed as a percentage that could not be resolved. */
  unresolved: number;
  margin_cents: number | null;
  margin_percent: number | null;
};

export function summariseCosts(
  costs: readonly ProjectCost[],
  serviceValueCents: number | null,
): CostSummary {
  let total = 0;
  let unresolved = 0;

  for (const cost of costs) {
    if (cost.amount_cents !== null) {
      total += cost.amount_cents;
      continue;
    }
    if (cost.percent_passed === null) continue;
    if (serviceValueCents === null) {
      unresolved += 1;
      continue;
    }
    total += Math.round((serviceValueCents * cost.percent_passed) / 100);
  }

  // No margin to report without a price, and none that can be trusted while a
  // percentage is unresolved — both return null rather than a number that
  // looks complete.
  const margin =
    serviceValueCents === null || unresolved > 0
      ? null
      : serviceValueCents - total;

  return {
    total_cents: total,
    unresolved,
    margin_cents: margin,
    margin_percent:
      margin === null || serviceValueCents === null || serviceValueCents === 0
        ? null
        : Math.round((margin / serviceValueCents) * 100),
  };
}
