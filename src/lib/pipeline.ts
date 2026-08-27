/**
 * Where a prospect sits in the commercial conversation, and what may happen to
 * it next.
 *
 * The rules live away from the action for the same reason the social module's
 * do: a rule only reachable through a form is a rule that drifts. The screen
 * renders from `movesForProspect` rather than branching on the stage itself,
 * so a stage cannot be offered a move the write would refuse.
 *
 * There is no `won`. Winning is `convert`, which sets `status = 'active'` and
 * clears the stage in one write — see migration 045 for why a second place
 * claiming someone is a client is a bad idea.
 */

export const PIPELINE_STAGES = [
  "new",
  "contacted",
  "proposal",
  "negotiation",
  "lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** The four a conversation moves along. `lost` is an exit, not a step. */
export const OPEN_STAGES = [
  "new",
  "contacted",
  "proposal",
  "negotiation",
] as const;

export function isPipelineStage(v: string): v is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(v);
}

export const PIPELINE_MOVES = ["advance", "regress", "lose", "reopen", "convert"] as const;
export type PipelineMove = (typeof PIPELINE_MOVES)[number];

export function isPipelineMove(v: string): v is PipelineMove {
  return (PIPELINE_MOVES as readonly string[]).includes(v);
}

export const PIPELINE_REFUSALS = [
  "notProspect",
  "unknownStage",
  "unknownMove",
  "atStart",
  "atEnd",
  "alreadyLost",
  "notLost",
  "needsReason",
] as const;
export type PipelineRefusal = (typeof PIPELINE_REFUSALS)[number];

export type StageVerdict =
  | { ok: true; stage: PipelineStage | null; status: "prospect" | "active" }
  | { ok: false; reason: PipelineRefusal };

/** The stage a prospect with no recorded position is treated as being at. */
export function stageOf(raw: string | null): PipelineStage {
  return raw && isPipelineStage(raw) ? raw : "new";
}

/**
 * The moves this prospect can make right now. The screen draws these; it does
 * not decide them.
 */
export function movesForProspect(input: {
  status: string;
  pipeline_stage: string | null;
}): PipelineMove[] {
  if (input.status !== "prospect") return [];
  const stage = stageOf(input.pipeline_stage);
  if (stage === "lost") return ["reopen"];

  const i = OPEN_STAGES.indexOf(stage as (typeof OPEN_STAGES)[number]);
  const moves: PipelineMove[] = [];
  if (i < OPEN_STAGES.length - 1) moves.push("advance");
  if (i > 0) moves.push("regress");
  // Winning is available at every open stage: a conversation can close early,
  // and forcing it through "negotiation" first would only teach people to
  // click past a stage that never happened.
  moves.push("convert", "lose");
  return moves;
}

/**
 * What the write should set. Returns the *target* — the action applies it, and
 * refuses on anything this says no to.
 */
export function applyMove(input: {
  move: string;
  status: string;
  pipeline_stage: string | null;
  /** Losing asks why; the note lands on the client, not in the void. */
  reason: string;
}): StageVerdict {
  if (!isPipelineMove(input.move)) return { ok: false, reason: "unknownMove" };
  if (input.status !== "prospect") return { ok: false, reason: "notProspect" };
  if (input.pipeline_stage !== null && !isPipelineStage(input.pipeline_stage)) {
    return { ok: false, reason: "unknownStage" };
  }

  const stage = stageOf(input.pipeline_stage);
  const move = input.move;
  const allowed = movesForProspect(input);
  if (!allowed.includes(move)) {
    // A precise refusal rather than one "not allowed" for all of them: the
    // screen says what is in the way, which is the difference between a
    // button that looks broken and one that explains itself.
    if (move === "advance") return { ok: false, reason: "atEnd" };
    if (move === "regress") return { ok: false, reason: "atStart" };
    if (move === "reopen") return { ok: false, reason: "notLost" };
    if (move === "lose") return { ok: false, reason: "alreadyLost" };
    return { ok: false, reason: "unknownMove" };
  }

  switch (move) {
    case "convert":
      // The one move that changes `status`. The stage goes with it, because
      // an active client holding a pipeline position is the drift migration
      // 045's constraint exists to prevent.
      return { ok: true, stage: null, status: "active" };
    case "lose":
      if (!input.reason.trim()) return { ok: false, reason: "needsReason" };
      return { ok: true, stage: "lost", status: "prospect" };
    case "reopen":
      return { ok: true, stage: "new", status: "prospect" };
    case "advance":
    case "regress": {
      const i = OPEN_STAGES.indexOf(stage as (typeof OPEN_STAGES)[number]);
      const next = OPEN_STAGES[move === "advance" ? i + 1 : i - 1];
      return { ok: true, stage: next, status: "prospect" };
    }
  }
}
