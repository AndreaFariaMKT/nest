import { describe, it, expect } from "vitest";

import { pickTenantId, TENANTS } from "@/lib/tenant";

const AFM = TENANTS.afm.id;
const NEST = TENANTS.nest.id;

describe("which house a login works in", () => {
  it("honours the chosen house when the login belongs to it", () => {
    expect(pickTenantId([AFM, NEST], NEST)).toBe(NEST);
    expect(pickTenantId([NEST, AFM], AFM)).toBe(AFM);
  });

  it("falls back to the lowest id without a choice — the rule before the switcher", () => {
    // Same fallback as current_tenant_id() in migration 059. If the two ever
    // disagree, the screen and the database work in different houses.
    expect(pickTenantId([NEST, AFM], undefined)).toBe(AFM);
    expect(pickTenantId([NEST, AFM], "")).toBe(AFM);
  });

  it("ignores a choice the login is not a member of", () => {
    // A stale cookie from another login on the same browser, or a forged one.
    expect(pickTenantId([NEST], AFM)).toBe(NEST);
  });

  it("returns null for a login with no house", () => {
    expect(pickTenantId([], NEST)).toBeNull();
  });
});
