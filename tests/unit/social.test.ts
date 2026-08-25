import { describe, it, expect } from "vitest";

import { APP_ROLES } from "@/lib/app-roles";

import {
  BLOCKED_REASONS,
  CLIENT_VISIBLE_STAGES,
  IN_FLIGHT_STAGES,
  SOCIAL_ACTIONS,
  SOCIAL_SCREENS,
  actionAllowedForRole,
  addWorkingDays,
  backlogStock,
  canReachSocialPath,
  canRun,
  canSetDesignState,
  canUseSocial,
  clientHealth,
  dayOf,
  daysBetween,
  firstSocialScreen,
  formatLabel,
  fortnightOf,
  isBlockedReason,
  isReplyOverdue,
  recentMonths,
  replyDueBy,
  socialCaps,
  socialScreensFor,
  todayIso,
  type SocialPiece,
  type SocialStage,
  waitingFor,
  weekStart,
} from "@/lib/social";

const piece = (over: Partial<SocialPiece> = {}): SocialPiece => ({
  id: "p1",
  client_id: "c1",
  title: "A piece",
  status: "backlog",
  design_state: "todo",
  pillar: "The method",
  caption: null,
  why_now: "Because",
  material_url: null,
  client_comment: null,
  publish_on: null,
  publish_time: "08:00",
  post_type: "carousel",
  slide_count: 5,
  channels: ["instagram"],
  origin: "research",
  backlog_added_on: "2026-08-20",
  ...over,
});

describe("working-day arithmetic", () => {
  it("steps back over a weekend", () => {
    // Mon 2026-09-07 minus one working day is Fri 2026-09-04.
    expect(addWorkingDays("2026-09-07", -1)).toBe("2026-09-04");
  });

  it("steps forward over a weekend", () => {
    expect(addWorkingDays("2026-09-04", 1)).toBe("2026-09-07");
  });

  it("never lands on a Saturday or Sunday", () => {
    for (let i = 1; i <= 30; i++) {
      const iso = addWorkingDays("2026-09-01", i);
      const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
  });

  it("counts plain days between dates", () => {
    expect(daysBetween("2026-09-01", "2026-09-08")).toBe(7);
    expect(daysBetween("2026-09-08", "2026-09-01")).toBe(-7);
  });

  it("finds the Monday of a week, including on a Sunday", () => {
    expect(weekStart("2026-09-09")).toBe("2026-09-07"); // Wed → Mon
    expect(weekStart("2026-09-07")).toBe("2026-09-07"); // Mon → itself
    expect(weekStart("2026-09-13")).toBe("2026-09-07"); // Sun → the Monday before
  });
});

describe("the client's reply window", () => {
  it("is five working days before the publish date", () => {
    // Fri 2026-09-11 → back five working days is Fri 2026-09-04.
    expect(replyDueBy("2026-09-11")).toBe("2026-09-04");
  });

  it("has no due date without a publish date", () => {
    expect(replyDueBy(null)).toBeNull();
    expect(replyDueBy("not-a-date")).toBeNull();
  });

  it("is overdue only once the date has passed", () => {
    expect(isReplyOverdue("2026-09-11", "2026-09-03")).toBe(false);
    expect(isReplyOverdue("2026-09-11", "2026-09-04")).toBe(false);
    expect(isReplyOverdue("2026-09-11", "2026-09-05")).toBe(true);
  });

  it("treats a piece with no date as never overdue", () => {
    expect(isReplyOverdue(null, "2026-09-30")).toBe(false);
  });
});

describe("fortnights", () => {
  const anchor = "2026-01-05"; // a Monday

  it("puts a sending week and the week after it in one fortnight", () => {
    const a = fortnightOf("2026-01-05", anchor);
    const b = fortnightOf("2026-01-12", anchor);
    expect(a.start).toBe(b.start);
    expect(a.start).toBe("2026-01-05");
    expect(a.end).toBe("2026-01-16");
  });

  it("starts a new fortnight on the third week", () => {
    expect(fortnightOf("2026-01-19", anchor).start).toBe("2026-01-19");
  });

  it("cuts approvals on the Wednesday of the sending week", () => {
    expect(fortnightOf("2026-01-08", anchor).sendingWeekEnd).toBe("2026-01-07");
  });

  it("still lands on a sending week before the anchor", () => {
    const f = fortnightOf("2025-12-29", anchor);
    expect(daysBetween(f.start, anchor) % 14).toBe(0);
  });
});

describe("backlog stock", () => {
  it("measures the shelf in fortnights, not items", () => {
    const s = backlogStock(8, 4);
    expect(s.fortnights).toBe(2);
    expect(s.low).toBe(false);
  });

  it("flags a shelf under two fortnights", () => {
    expect(backlogStock(7, 4).low).toBe(true);
    expect(backlogStock(7, 4).critical).toBe(false);
  });

  it("flags a shelf under one fortnight as critical", () => {
    const s = backlogStock(3, 4);
    expect(s.critical).toBe(true);
    expect(s.low).toBe(true);
  });

  it("never divides by zero", () => {
    expect(backlogStock(4, 0).fortnights).toBe(4);
  });
});

describe("the state machine", () => {
  it("pulls a theme off the shelf into writing", () => {
    const v = canRun("pull", piece());
    expect(v).toEqual({ ok: true, next: "draft" });
  });

  it("refuses to pull something already in flight", () => {
    const v = canRun("pull", piece({ status: "draft" }));
    expect(v).toEqual({ ok: false, reason: "notOnShelf" });
  });

  it("will not send a placeholder up to direction", () => {
    expect(canRun("send_text_up", piece({ status: "draft" }))).toEqual({
      ok: false,
      reason: "needsText",
    });
    expect(
      canRun("send_text_up", piece({ status: "draft", caption: "   " })),
    ).toEqual({ ok: false, reason: "needsText" });
  });

  it("sends real text up", () => {
    expect(
      canRun("send_text_up", piece({ status: "draft", caption: "Real copy" })),
    ).toEqual({ ok: true, next: "text_review" });
  });

  it("sends an approved argument straight into design", () => {
    expect(canRun("direction_approve", piece({ status: "text_review" }))).toEqual(
      { ok: true, next: "creative_review" },
    );
  });

  it("makes direction say what to change when sending back", () => {
    expect(canRun("direction_reject", piece({ status: "text_review" }))).toEqual({
      ok: false,
      reason: "needsDirectionNote",
    });
    expect(
      canRun("direction_reject", piece({ status: "text_review" }), {
        comment: "Lose the finger-wagging",
      }),
    ).toEqual({ ok: true, next: "draft" });
  });

  it("will not hand the client unsigned art", () => {
    expect(
      canRun("send_to_client", piece({ status: "creative_review", design_state: "done" })),
    ).toEqual({ ok: false, reason: "needsSignOff" });
  });

  it("hands the client signed-off art with a folder link", () => {
    expect(
      canRun(
        "send_to_client",
        piece({
          status: "creative_review",
          design_state: "signed_off",
          material_url: "https://drive/x",
        }),
      ),
    ).toEqual({ ok: true, next: "client_review" });
  });

  it("lets the client approve without saying anything", () => {
    expect(canRun("client_approve", piece({ status: "client_review" }))).toEqual({
      ok: true,
      next: "approved",
    });
  });

  it("makes the client explain a change or a refusal", () => {
    expect(
      canRun("client_request_changes", piece({ status: "client_review" })),
    ).toEqual({ ok: false, reason: "needsClientNote" });
    expect(canRun("client_reject", piece({ status: "client_review" }))).toEqual({
      ok: false,
      reason: "needsRejectReason",
    });
    expect(
      canRun("client_reject", piece({ status: "client_review" }), {
        comment: "Wrong theme entirely",
      }),
    ).toEqual({ ok: true, next: "rejected" });
  });

  it("lets a client still change their mind after asking for changes", () => {
    expect(
      canRun("client_approve", piece({ status: "changes_requested" })),
    ).toEqual({ ok: true, next: "approved" });
  });

  it("routes a changes-requested piece back to design, not to writing", () => {
    expect(
      canRun("reopen_to_design", piece({ status: "changes_requested" })),
    ).toEqual({ ok: true, next: "creative_review" });
  });

  it("returns a rejected piece to the shelf", () => {
    expect(canRun("return_to_backlog", piece({ status: "rejected" }))).toEqual({
      ok: true,
      next: "backlog",
    });
  });

  it("queues only approved pieces", () => {
    expect(canRun("queue", piece({ status: "approved" }))).toEqual({
      ok: true,
      next: "scheduled",
    });
    expect(canRun("queue", piece({ status: "client_review" }))).toEqual({
      ok: false,
      reason: "notApproved",
    });
  });

  it("marks live and undoes it", () => {
    expect(canRun("mark_live", piece({ status: "scheduled" }))).toEqual({
      ok: true,
      next: "published",
    });
    expect(canRun("unmark_live", piece({ status: "published" }))).toEqual({
      ok: true,
      next: "scheduled",
    });
    expect(canRun("unmark_live", piece({ status: "scheduled" }))).toEqual({
      ok: false,
      reason: "notLive",
    });
  });

  it("only ever refuses with a reason the UI can translate", () => {
    const stages: SocialStage[] = [
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
    ];
    for (const status of stages) {
      const v = canRun("send_to_client", piece({ status }));
      if (!v.ok) expect(isBlockedReason(v.reason)).toBe(true);
    }
    expect(BLOCKED_REASONS.length).toBeGreaterThan(20);
  });
});

describe("silence past the reply date", () => {
  // The module promises the studio that a quiet client never stalls the
  // calendar. Before this transition existed, client_review was a dead end.
  const withClient = (publish_on: string) =>
    piece({ status: "client_review", publish_on });

  it("lets coordination run a piece whose reply date has passed", () => {
    expect(
      canRun("approve_on_silence", withClient("2026-09-11"), {
        today: "2026-09-07",
      }),
    ).toEqual({ ok: true, next: "approved" });
  });

  it("refuses while the client still has their window", () => {
    expect(
      canRun("approve_on_silence", withClient("2026-09-11"), {
        today: "2026-09-03",
      }),
    ).toEqual({ ok: false, reason: "notOverdue" });
  });

  it("refuses on the due date itself — the client has all of it", () => {
    expect(
      canRun("approve_on_silence", withClient("2026-09-11"), {
        today: "2026-09-04",
      }),
    ).toEqual({ ok: false, reason: "notOverdue" });
  });

  it("refuses on a piece with no date, which can never be overdue", () => {
    expect(
      canRun("approve_on_silence", piece({ status: "client_review" })).ok,
    ).toBe(false);
  });

  it("is coordination's call, not the client's", () => {
    expect(actionAllowedForRole("approve_on_silence", "founder")).toBe(true);
    expect(actionAllowedForRole("approve_on_silence", "manager")).toBe(true);
    expect(actionAllowedForRole("approve_on_silence", "client")).toBe(false);
    expect(actionAllowedForRole("approve_on_silence", "designer_social")).toBe(
      false,
    );
  });

  it("leaves no stage that cannot be left", () => {
    // Every in-flight stage must have at least one action that moves a piece
    // out of it for somebody — otherwise a piece can strand.
    const stages: SocialStage[] = [
      "backlog", "draft", "text_review", "creative_review",
      "client_review", "changes_requested", "rejected", "approved", "scheduled",
    ];
    for (const status of stages) {
      const p = piece({
        status,
        caption: "text",
        material_url: "https://drive/x",
        design_state: "signed_off",
        publish_on: "2026-09-11",
      });
      const escapes = SOCIAL_ACTIONS.filter((a) => {
        const v = canRun(a, p, { comment: "reason", today: "2026-09-30" });
        return v.ok && v.next !== status;
      });
      expect(escapes.length, `${status} has no way out`).toBeGreaterThan(0);
    }
  });
});

describe("sending to the client", () => {
  it("refuses when the folder link was cleared after sign-off", () => {
    // Sign-off checks the link, but coordination can blank it afterwards, so
    // the guard is repeated at the door.
    expect(
      canRun(
        "send_to_client",
        piece({
          status: "creative_review",
          design_state: "signed_off",
          material_url: null,
        }),
      ),
    ).toEqual({ ok: false, reason: "needsMaterialToSend" });
  });

  it("allows it once the link is there", () => {
    expect(
      canRun(
        "send_to_client",
        piece({
          status: "creative_review",
          design_state: "signed_off",
          material_url: "https://drive/x",
        }),
      ),
    ).toEqual({ ok: true, next: "client_review" });
  });
});

describe("the studio's calendar day", () => {
  it("stays on the local day when UTC has already rolled over", () => {
    // 21:30 in São Paulo on 1 March is 00:30 UTC on 2 March. Reading the UTC
    // day would report tomorrow.
    expect(todayIso(new Date("2026-03-02T00:30:00Z"))).toBe("2026-03-01");
  });

  it("rolls over at local midnight, not UTC midnight", () => {
    expect(todayIso(new Date("2026-03-02T03:30:00Z"))).toBe("2026-03-02");
  });

  it("reads a timestamp as the day it happened locally", () => {
    expect(dayOf("2026-03-02T00:30:00Z")).toBe("2026-03-01");
    expect(dayOf(null)).toBeNull();
    expect(dayOf("not a timestamp")).toBeNull();
  });
});

describe("design state", () => {
  it("will not mark a piece done with no folder link", () => {
    expect(
      canSetDesignState({ status: "creative_review", material_url: null }, "done"),
    ).toEqual({ ok: false, reason: "needsMaterial" });
  });

  it("accepts a folder link", () => {
    expect(
      canSetDesignState(
        { status: "creative_review", material_url: "https://drive/x" },
        "done",
      ).ok,
    ).toBe(true);
  });

  it("always allows going back to 'to do'", () => {
    expect(
      canSetDesignState({ status: "creative_review", material_url: null }, "todo")
        .ok,
    ).toBe(true);
  });

  it("refuses outside design entirely", () => {
    expect(
      canSetDesignState({ status: "draft", material_url: "x" }, "done"),
    ).toEqual({ ok: false, reason: "notInDesign" });
  });
});

describe("who may do what", () => {
  it("gives the founder direction, coordination and publishing", () => {
    expect(socialCaps("founder")).toEqual([
      "direction",
      "coordinate",
      "publish",
    ]);
  });

  it("keeps roles outside the module out of it", () => {
    expect(canUseSocial("accountant")).toBe(false);
    expect(canUseSocial("developer")).toBe(false);
    expect(canUseSocial("designer_identity")).toBe(false);
    expect(canUseSocial("designer_social")).toBe(true);
  });

  it("lets only direction approve a text", () => {
    expect(actionAllowedForRole("direction_approve", "founder")).toBe(true);
    expect(actionAllowedForRole("direction_approve", "manager")).toBe(false);
    expect(actionAllowedForRole("direction_approve", "designer_social")).toBe(false);
  });

  it("lets only the client decide on a client-facing piece", () => {
    expect(actionAllowedForRole("client_approve", "client")).toBe(true);
    expect(actionAllowedForRole("client_approve", "founder")).toBe(false);
  });

  it("shows design only the screens it works in", () => {
    const keys = socialScreensFor("designer_social").map((s) => s.key);
    expect(keys).toContain("production");
    expect(keys).toContain("waiting");
    expect(keys).not.toContain("logins");
    expect(keys).not.toContain("backlog");
  });

  it("shows a client-role login no module screens at all", () => {
    // The client's own views live in the portal, not here.
    expect(socialScreensFor("client").map((s) => s.key)).toEqual(["waiting"]);
  });
});

describe("client health", () => {
  const today = "2026-09-07";

  it("is calm when the shelf is deep and nothing came back", () => {
    const pieces = Array.from({ length: 8 }, () => piece({ status: "backlog" }));
    const h = clientHealth(pieces, 2, today);
    expect(h.level).toBe("ok");
    expect(h.reason).toBe("onRhythm");
  });

  it("treats a client with nothing at all as new, not as failing", () => {
    // Onboarding used to paint every new client red: zero backlog against a
    // per-cycle default of two is "below one fortnight", which is true and
    // useless on day one.
    const h = clientHealth([], 2, today);
    expect(h.level).toBe("new");
    expect(h.reason).toBe("neverStocked");
  });

  it("still calls out a shelf that had stock and lost it", () => {
    // One piece anywhere is enough to prove the client has been worked on, so
    // a thin shelf is a real signal rather than the initial state.
    const h = clientHealth([piece({ status: "published" })], 2, today);
    expect(h.level).toBe("bad");
    expect(h.reason).toBe("stockCritical");
  });

  it("warns on a thin shelf", () => {
    const h = clientHealth([piece({ status: "backlog" })], 2, today);
    expect(h.level).toBe("bad"); // under one fortnight
    expect(h.reason).toBe("stockCritical");
  });

  it("warns about pieces with no text yet", () => {
    const pieces = [
      ...Array.from({ length: 8 }, () => piece({ status: "backlog" })),
      piece({ status: "draft", caption: null }),
    ];
    const h = clientHealth(pieces, 2, today);
    expect(h.reason).toBe("unwritten");
    expect(h.count).toBe(1);
  });

  it("ranks a passed reply date above everything else", () => {
    const pieces = [
      ...Array.from({ length: 8 }, () => piece({ status: "backlog" })),
      piece({ status: "draft", caption: null }),
      piece({ status: "changes_requested", caption: "x", publish_on: "2026-09-08" }),
      piece({ status: "client_review", publish_on: "2026-09-08" }),
    ];
    const h = clientHealth(pieces, 2, today);
    expect(h.level).toBe("bad");
    expect(h.reason).toBe("replyOverdue");
    expect(h.overdue).toBe(2);
  });

  it("counts what is with the client and what went live", () => {
    const h = clientHealth(
      [
        piece({ status: "client_review", publish_on: "2026-10-30" }),
        piece({ status: "published" }),
        piece({ status: "published" }),
      ],
      2,
      today,
    );
    expect(h.withClient).toBe(1);
    expect(h.live).toBe(2);
  });
});

describe("waiting on you", () => {
  const clients = new Map([["c1", { name: "Helem", perCycle: 2 }]]);
  const today = "2026-09-07";

  const shelf = Array.from({ length: 8 }, (_, i) =>
    piece({ id: `b${i}`, status: "backlog" }),
  );

  it("gives direction the texts and the rejections, nothing else", () => {
    const pieces = [
      ...shelf,
      piece({ id: "t1", status: "text_review" }),
      piece({ id: "r1", status: "rejected" }),
      piece({ id: "d1", status: "draft", caption: null }),
    ];
    const out = waitingFor(["direction"], { pieces, clients, today });
    expect(out.map((e) => e.reason).sort()).toEqual([
      "approveText",
      "decideRejected",
    ]);
  });

  it("separates written drafts from unwritten ones for coordination", () => {
    const pieces = [
      ...shelf,
      piece({ id: "d1", status: "draft", caption: "written" }),
      piece({ id: "d2", status: "draft", caption: null }),
    ];
    const out = waitingFor(["coordinate"], { pieces, clients, today });
    const reasons = out.map((e) => e.reason);
    expect(reasons).toContain("sendTextUp");
    expect(reasons).toContain("stillToWrite");
  });

  it("nags coordination to restock a thin shelf, pointing at the client", () => {
    const pieces = [piece({ status: "backlog" })];
    const out = waitingFor(["coordinate"], { pieces, clients, today });
    const restock = out.find((e) => e.reason === "restock");
    expect(restock).toBeDefined();
    expect(restock?.id).toBeNull();
    expect(restock?.clientId).toBe("c1");
  });

  it("does not nag about a healthy shelf", () => {
    const out = waitingFor(["coordinate"], { pieces: shelf, clients, today });
    expect(out.some((e) => e.reason === "restock")).toBe(false);
  });

  it("splits design's queue by whether it has been drawn", () => {
    const pieces = [
      piece({ id: "x", status: "creative_review", design_state: "todo" }),
      piece({ id: "y", status: "creative_review", design_state: "done" }),
      piece({ id: "z", status: "creative_review", design_state: "signed_off" }),
    ];
    const out = waitingFor(["design"], { pieces, clients, today });
    expect(out.map((e) => e.reason)).toEqual([
      "toDraw",
      "drawnAwaitingSignOff",
    ]);
  });

  it("tells the client whether the reply date has passed", () => {
    const pieces = [
      piece({ id: "a", status: "client_review", publish_on: "2026-10-30" }),
      piece({ id: "b", status: "client_review", publish_on: "2026-09-08" }),
    ];
    const out = waitingFor(["client"], { pieces, clients, today });
    expect(out.map((e) => e.reason)).toEqual(["replyBy", "replyPassed"]);
  });

  it("merges the lists for a login that wears two hats", () => {
    const pieces = [
      ...shelf,
      piece({ id: "t1", status: "text_review" }),
      piece({ id: "s1", status: "scheduled", publish_on: "2026-09-09" }),
    ];
    const out = waitingFor(["direction", "coordinate", "publish"], {
      pieces,
      clients,
      today,
    });
    const reasons = out.map((e) => e.reason);
    expect(reasons).toContain("approveText");
    expect(reasons).toContain("toSchedule");
  });

  it("is empty when nothing is owed", () => {
    expect(
      waitingFor(["publish"], { pieces: shelf, clients, today }),
    ).toHaveLength(0);
  });
});

describe("stage groupings", () => {
  it("keeps the shelf and the archive out of the fortnight", () => {
    expect(IN_FLIGHT_STAGES).not.toContain("backlog");
    expect(IN_FLIGHT_STAGES).not.toContain("published");
    expect(IN_FLIGHT_STAGES).not.toContain("scheduled");
  });

  it("never shows the client anything before it is theirs to read", () => {
    for (const hidden of ["backlog", "draft", "text_review", "creative_review", "rejected"]) {
      expect(CLIENT_VISIBLE_STAGES).not.toContain(hidden as SocialStage);
    }
    expect(CLIENT_VISIBLE_STAGES).toContain("client_review");
  });
});

describe("format labels", () => {
  const label = (k: string) => ({ carousel: "Carousel", reel: "Reel", unset: "—" })[k] ?? k;

  it("counts slides only for a carousel", () => {
    expect(formatLabel("carousel", 5, label)).toBe("Carousel · 5");
    expect(formatLabel("reel", 5, label)).toBe("Reel");
  });

  it("says so when the format is not set", () => {
    expect(formatLabel(null, null, label)).toBe("—");
  });
});

describe("per-screen access inside the module", () => {
  // The middleware and loadScope both ask this one function, so these cases
  // are the whole rule. A screen added to SOCIAL_SCREENS without a thought
  // about who may see it is denied here rather than silently open.
  it("holds every screen to the capabilities it declares", () => {
    for (const screen of SOCIAL_SCREENS) {
      if (!screen.href.startsWith("/social")) continue;
      for (const role of APP_ROLES) {
        const allowed = canReachSocialPath(role, screen.href);
        const caps = socialCaps(role);
        expect(
          allowed,
          `${role} → ${screen.href}`,
        ).toBe(screen.caps.some((c) => caps.includes(c)));
      }
    }
  });

  it("admits the piece record to anyone the module admits", () => {
    // Not a screen in the list: it renders per-capability panels of its own,
    // and it is where the screens each role legitimately reaches all link.
    expect(canReachSocialPath("designer_social", "/social/pieces/x")).toBe(true);
    expect(canReachSocialPath("accountant", "/social/pieces/x")).toBe(false);
  });

  it("denies a path that is not a screen at all", () => {
    expect(canReachSocialPath("founder", "/social/not-a-screen")).toBe(false);
  });

  it("never bounces a role somewhere it cannot go", () => {
    for (const role of APP_ROLES) {
      if (socialCaps(role).length === 0) continue;
      const target = firstSocialScreen(role);
      expect(canReachSocialPath(role, target), `${role} → ${target}`).toBe(true);
    }
  });
});

describe("recentMonths", () => {
  // The month picker on the client page is built from this, and the action
  // refuses anything it would not have offered.
  it("starts at the month before, never the running one", () => {
    // A report about a month still in progress is a number that will change,
    // and the studio writes this one between the 3rd and the 7th about the
    // month that just ended — the day the old hardcoded "now" was most wrong.
    expect(recentMonths(3, "2026-09-03")).toEqual([
      { year: 2026, month: 8 },
      { year: 2026, month: 7 },
      { year: 2026, month: 6 },
    ]);
  });

  it("walks back across a year boundary", () => {
    expect(recentMonths(3, "2026-01-05")).toEqual([
      { year: 2025, month: 12 },
      { year: 2025, month: 11 },
      { year: 2025, month: 10 },
    ]);
  });

  it("does not offer the running month even on its last day", () => {
    const offered = recentMonths(12, "2026-08-31");
    expect(offered).not.toContainEqual({ year: 2026, month: 8 });
    expect(offered[0]).toEqual({ year: 2026, month: 7 });
  });
});
