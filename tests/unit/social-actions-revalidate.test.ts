import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The invariant the removed `router.refresh()` calls now depend on.
 *
 * A server action's response only carries a re-rendered tree for the current
 * route when something in that action called `revalidatePath` — Next decides
 * with `skipFlight: !pathWasRevalidated`. Every write in this module does,
 * which is why the client no longer needs to fetch the route a second time.
 *
 * If a future action returns success without revalidating, the UI would go
 * stale with nothing to explain it — and the symptom (a save that appears not
 * to save) is exactly the silent "no" this module is built against. So the
 * rule is checked here rather than left to memory.
 *
 * Read as source text on purpose: the actions are "use server" and importing
 * them pulls in Supabase, cookies and next/headers. What matters is a
 * structural property of the file, and that is visible without running it.
 */

const SOURCE = readFileSync(
  "src/app/[locale]/(app)/social/actions.ts",
  "utf8",
);

/** Split the file into one entry per exported action. */
function exportedActions(): { name: string; body: string }[] {
  const parts = SOURCE.split(/\nexport async function (\w+)/);
  const out: { name: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    out.push({ name: parts[i], body: parts[i + 1] });
  }
  return out;
}

const RETURNS_OK = /return\s+OK\b|return\s*\{\s*ok:\s*true/;
const REVALIDATES = /revalidateModule\(|revalidatePath\(/;

/**
 * Reads, not writes. `revealSecretAction` decrypts a stored password and
 * returns it; it changes nothing, so revalidating would only cost a render.
 * Listed explicitly rather than inferred, so adding a genuine write here is a
 * deliberate act and not an accident.
 */
const READ_ONLY = new Set(["revealSecretAction"]);

describe("every social action that can succeed also revalidates", () => {
  const actions = exportedActions();

  it("finds the actions at all — guards against the parser silently matching nothing", () => {
    expect(actions.length).toBeGreaterThan(8);
    expect(actions.map((a) => a.name)).toContain("runTransitionAction");
  });

  it.each(
    actions
      .filter((a) => RETURNS_OK.test(a.body) && !READ_ONLY.has(a.name))
      .map((a) => a.name),
  )(
    "%s revalidates before returning success",
    (name) => {
      const action = actions.find((a) => a.name === name)!;
      expect(REVALIDATES.test(action.body)).toBe(true);
    },
  );

  it("nothing in the module calls router.refresh() any more", () => {
    // The refresh fetched a tree the action response already contained: a
    // second auth hop, a second layout render, a second listPieces() over the
    // whole tenant, and a second copy of the message catalogue.
    const components = readFileSync(
      "src/app/[locale]/(app)/social/_components/ActionPrimitives.tsx",
      "utf8",
    );
    expect(components).not.toMatch(/^\s*router\.refresh\(\)/m);
  });
});
