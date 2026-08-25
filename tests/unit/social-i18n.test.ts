import { describe, it, expect } from "vitest";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";
import {
  BLOCKED_REASONS,
  CONTENT_ORIGINS,
  DESIGN_STATES,
  SOCIAL_ACTIONS,
  SOCIAL_CHANNELS,
  SOCIAL_SCREENS,
  SOCIAL_STAGES,
  canRun,
  movesFor,
  type SocialCap,
  type SocialPiece,
  type SocialStage,
} from "@/lib/social";
import { POST_TYPES } from "@/types/database";

/**
 * The module renders most of its labels from a dynamic key —
 * `t(\`stage.${p.status}\`)`, `t(\`actions.${move.action}\`)`. TypeScript cannot
 * see those, and a missing key throws at render time in next-intl. So the
 * enums are checked against the dictionaries here, in both locales, and adding
 * a stage or an action without its strings fails the build instead of the page.
 */

type Dict = Record<string, unknown>;

const LOCALES: [string, Dict][] = [
  ["en", en as unknown as Dict],
  ["pt-BR", ptBR as unknown as Dict],
];

function at(dict: Dict, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object"
          ? (node as Dict)[key]
          : undefined,
      dict,
    );
}

function expectKeys(prefix: string, keys: readonly string[]) {
  for (const [locale, dict] of LOCALES) {
    for (const key of keys) {
      const value = at(dict, `social.${prefix}.${key}`);
      expect(
        typeof value === "string" && value.length > 0,
        `${locale}: social.${prefix}.${key} is missing`,
      ).toBe(true);
    }
  }
}

describe("every enum the module renders has strings in both locales", () => {
  it("stages", () => expectKeys("stage", SOCIAL_STAGES));
  it("design states", () => expectKeys("designState", DESIGN_STATES));
  it("channels", () => expectKeys("channel", SOCIAL_CHANNELS));
  it("origins", () => expectKeys("themeForm.originValue", CONTENT_ORIGINS));
  it("post types", () => expectKeys("format", [...POST_TYPES, "unset"]));
  it("refusals", () => expectKeys("blocked", BLOCKED_REASONS));
  it("actions", () =>
    expectKeys(
      "actions",
      // `set_design_state` is never a button label: it is the design row, which
      // renders from `designState.*`. Every other action can appear as a move.
      SOCIAL_ACTIONS.filter((a) => a !== "set_design_state"),
    ));
  it("screens", () =>
    expectKeys(
      "screens",
      SOCIAL_SCREENS.map((s) => s.key),
    ));
  it("waiting reasons", () =>
    expectKeys("waiting.reasons", [
      "approveText",
      "decideRejected",
      "sendTextUp",
      "stillToWrite",
      "signOffArt",
      "sendToClient",
      "backToDesign",
      "restock",
      "toDraw",
      "drawnAwaitingSignOff",
      "notInOrder",
      "toSchedule",
      "replyBy",
      "replyPassed",
    ]));
  it("health readings", () =>
    expectKeys("health", [
      "onRhythm",
      "stockLow",
      "stockCritical",
      "unwritten",
      "returned",
      "replyOverdue",
    ]));
  it("waiting-on lines", () =>
    expectKeys("waitingOn", [
      "direction",
      "design",
      "client",
      "order",
      "writing",
    ]));
});

describe("every move the domain can offer is renderable", () => {
  const piece = (over: Partial<SocialPiece>): SocialPiece =>
    ({
      id: "p",
      client_id: "c",
      title: "t",
      status: "backlog",
      design_state: "signed_off",
      pillar: null,
      caption: "text",
      why_now: null,
      material_url: "https://drive/x",
      client_comment: null,
      publish_on: "2026-09-11",
      publish_time: "08:00",
      post_type: "carousel",
      slide_count: 5,
      channels: ["instagram"],
      origin: "research",
      backlog_added_on: "2026-08-01",
      ...over,
    }) as SocialPiece;

  const ALL_CAPS: SocialCap[] = [
    "direction",
    "coordinate",
    "design",
    "publish",
    "client",
  ];

  it("offers a label — and a comment label where one is required", () => {
    for (const status of SOCIAL_STAGES) {
      for (const caps of [ALL_CAPS, ["client"] as SocialCap[]]) {
        const set = movesFor(piece({ status }), caps, "2026-09-30");
        for (const move of set.moves) {
          expectKeys("actions", [move.action]);
          if (move.needsComment) {
            expectKeys(`actions.comment.${move.action}`, ["label", "hint"]);
          }
        }
      }
    }
  });

  it("never offers a move the state machine would refuse", () => {
    // The screens render from movesFor; the server re-checks with canRun. If
    // they disagree, a button exists that always fails.
    for (const status of SOCIAL_STAGES) {
      const p = piece({ status });
      for (const move of movesFor(p, ALL_CAPS, "2026-09-30").moves) {
        const verdict = canRun(move.action, p, {
          comment: move.needsComment ? "a reason" : "",
          today: "2026-09-30",
        });
        expect(verdict.ok, `${status} → ${move.action} would be refused`).toBe(
          true,
        );
      }
    }
  });

  it("gives a client only the moves that are theirs", () => {
    const clientMoves = SOCIAL_STAGES.flatMap((status: SocialStage) =>
      movesFor(piece({ status }), ["client"], "2026-09-30").moves.map(
        (m) => m.action,
      ),
    );
    expect(new Set(clientMoves)).toEqual(
      new Set(["client_approve", "client_request_changes", "client_reject"]),
    );
  });
});

describe("the two dictionaries stay in step", () => {
  it("has the same key set under social.*", () => {
    const flatten = (node: unknown, prefix = ""): string[] => {
      if (node === null || typeof node !== "object") return [prefix];
      return Object.entries(node as Dict).flatMap(([k, v]) =>
        flatten(v, prefix ? `${prefix}.${k}` : k),
      );
    };
    const a = new Set(flatten(at(en as unknown as Dict, "social")));
    const b = new Set(flatten(at(ptBR as unknown as Dict, "social")));
    expect([...a].filter((k) => !b.has(k))).toEqual([]);
    expect([...b].filter((k) => !a.has(k))).toEqual([]);
  });
});
