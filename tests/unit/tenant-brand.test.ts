import { describe, it, expect } from "vitest";

import { isTheme } from "@/lib/theme";
import { TENANT_LIST } from "@/lib/tenant";

/**
 * The theme used to be a constant in the code. It comes from `tenants.theme`
 * now, which means it is a string from the database standing between a request
 * and which stylesheet and which logo render — so it gets validated on the way
 * in rather than trusted.
 */
describe("theme validation", () => {
  it("accepts the two houses", () => {
    expect(isTheme("afm")).toBe(true);
    expect(isTheme("nest")).toBe(true);
  });

  it("rejects anything else, including empty and null", () => {
    // A row edited by hand, or a third house added to the table without the
    // stylesheet to match. Falling through to a valid theme keeps the app
    // painted; trusting the string would leave it unstyled.
    expect(isTheme("AFM")).toBe(false);
    expect(isTheme("")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme("nest ")).toBe(false);
  });

  it("every hardcoded fallback tenant carries a valid theme", () => {
    // The map is the floor when the database row cannot be read. A bad theme
    // in it would defeat the point of the floor.
    for (const tenant of TENANT_LIST) {
      expect(isTheme(tenant.theme), tenant.slug).toBe(true);
    }
  });
});
