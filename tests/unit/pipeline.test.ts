import { describe, expect, it } from "vitest";

import {
  OPEN_STAGES,
  PIPELINE_STAGES,
  applyMove,
  isPipelineStage,
  movesForProspect,
  stageOf,
} from "@/lib/pipeline";

const prospect = (stage: string | null = "new") => ({
  status: "prospect",
  pipeline_stage: stage,
});

describe("stageOf", () => {
  it("treats an unrecorded position as the beginning", () => {
    expect(stageOf(null)).toBe("new");
  });
  it("does not trust a value the schema would refuse", () => {
    expect(stageOf("won")).toBe("new");
  });
});

describe("movesForProspect", () => {
  it("offers nothing on someone who is not a prospect", () => {
    for (const status of ["active", "paused", "archived"]) {
      expect(movesForProspect({ status, pipeline_stage: null })).toEqual([]);
    }
  });

  it("cannot regress from the first stage or advance past the last", () => {
    expect(movesForProspect(prospect("new"))).not.toContain("regress");
    expect(movesForProspect(prospect("negotiation"))).not.toContain("advance");
  });

  it("lets a conversation be won at any open stage", () => {
    // A deal can close early; making people click through a stage that never
    // happened only teaches them to click through stages.
    for (const s of OPEN_STAGES) {
      expect(movesForProspect(prospect(s)), s).toContain("convert");
    }
  });

  it("offers only reopen once lost", () => {
    expect(movesForProspect(prospect("lost"))).toEqual(["reopen"]);
  });

  it("never offers a move applyMove would refuse", () => {
    // The screen renders from this list, so anything offered here has to run.
    for (const stage of PIPELINE_STAGES) {
      for (const move of movesForProspect(prospect(stage))) {
        const v = applyMove({ ...prospect(stage), move, reason: "no budget" });
        expect(v.ok, `${stage} → ${move}`).toBe(true);
      }
    }
  });
});

describe("applyMove", () => {
  it("walks forward and back through the open stages", () => {
    expect(applyMove({ ...prospect("new"), move: "advance", reason: "" })).toEqual(
      { ok: true, stage: "contacted", status: "prospect" },
    );
    expect(
      applyMove({ ...prospect("proposal"), move: "regress", reason: "" }),
    ).toEqual({ ok: true, stage: "contacted", status: "prospect" });
  });

  it("converting clears the stage as it sets the status", () => {
    // Migration 045 constrains this: an active client holding a pipeline
    // position is two records disagreeing about whether they are a client.
    expect(
      applyMove({ ...prospect("proposal"), move: "convert", reason: "" }),
    ).toEqual({ ok: true, stage: null, status: "active" });
  });

  it("will not record a loss without a reason", () => {
    expect(applyMove({ ...prospect("proposal"), move: "lose", reason: "  " })).toEqual(
      { ok: false, reason: "needsReason" },
    );
    expect(
      applyMove({ ...prospect("proposal"), move: "lose", reason: "went in-house" }),
    ).toEqual({ ok: true, stage: "lost", status: "prospect" });
  });

  it("reopens a lost conversation at the beginning", () => {
    expect(applyMove({ ...prospect("lost"), move: "reopen", reason: "" })).toEqual(
      { ok: true, stage: "new", status: "prospect" },
    );
  });

  it("says what is in the way, not just no", () => {
    expect(
      applyMove({ ...prospect("negotiation"), move: "advance", reason: "" }),
    ).toEqual({ ok: false, reason: "atEnd" });
    expect(applyMove({ ...prospect("new"), move: "regress", reason: "" })).toEqual({
      ok: false,
      reason: "atStart",
    });
    expect(applyMove({ ...prospect("lost"), move: "lose", reason: "x" })).toEqual({
      ok: false,
      reason: "alreadyLost",
    });
    expect(applyMove({ ...prospect("new"), move: "reopen", reason: "" })).toEqual({
      ok: false,
      reason: "notLost",
    });
  });

  it("refuses anyone who is not a prospect before it looks at the move", () => {
    expect(
      applyMove({
        status: "active",
        pipeline_stage: null,
        move: "convert",
        reason: "",
      }),
    ).toEqual({ ok: false, reason: "notProspect" });
  });

  it("refuses a move and a stage it does not know", () => {
    expect(applyMove({ ...prospect("new"), move: "delete", reason: "" })).toEqual({
      ok: false,
      reason: "unknownMove",
    });
    expect(
      applyMove({ ...prospect("won"), move: "advance", reason: "" }),
    ).toEqual({ ok: false, reason: "unknownStage" });
  });
});

describe("isPipelineStage", () => {
  it("has no 'won' — winning is the conversion", () => {
    expect(isPipelineStage("won")).toBe(false);
    expect(isPipelineStage("lost")).toBe(true);
  });
});
