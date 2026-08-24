import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src/app/[locale]/(app)/messages");

/**
 * The compose box no longer calls router.refresh() — the action's own response
 * carries the re-rendered route. That only holds while the action revalidates
 * the path the reader is ACTUALLY on, and localePrefix is "as-needed": a
 * pt-BR reader sits on /messages, not /pt-BR/messages. Revalidating only the
 * prefixed form would leave the list frozen with nothing to notice it, because
 * the refresh that used to hide the gap is gone.
 */
describe("sendMessageAction revalidation", () => {
  const source = readFileSync(join(root, "actions.ts"), "utf8");

  it("revalidates both the prefixed and unprefixed path", () => {
    for (const path of ["/messages", "/portal/messages"]) {
      expect(source).toContain(`"${path}"`);
    }
    expect(source).toContain("revalidatePath(`/${locale}${path}`)");
    expect(source).toContain("revalidatePath(path)");
  });

  it("does not lean on a client-side refresh", () => {
    const compose = readFileSync(join(root, "ComposeMessage.tsx"), "utf8");
    expect(compose).not.toContain("router.refresh()");
  });
});
