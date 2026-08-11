import { describe, it, expect } from "vitest";

import { guardRedirect, mapLegacyRole, isAppRoleValue } from "@/lib/guard";

describe("mapLegacyRole", () => {
  it("passes app roles through", () => {
    expect(mapLegacyRole("accountant")).toBe("accountant");
    expect(mapLegacyRole("client")).toBe("client");
  });
  it("maps legacy values", () => {
    expect(mapLegacyRole("owner")).toBe("founder");
    expect(mapLegacyRole("admin")).toBe("founder");
    expect(mapLegacyRole("member")).toBe("manager");
    expect(mapLegacyRole(null)).toBe("manager");
  });
});

describe("isAppRoleValue", () => {
  it("validates", () => {
    expect(isAppRoleValue("founder")).toBe(true);
    expect(isAppRoleValue("owner")).toBe(false);
    expect(isAppRoleValue(undefined)).toBe(false);
  });
});

describe("guardRedirect", () => {
  it("isolates clients to the portal", () => {
    expect(guardRedirect("/today", "client")).toBe("/portal");
    expect(guardRedirect("/finance", "client")).toBe("/portal");
    expect(guardRedirect("/portal", "client")).toBeNull();
    expect(guardRedirect("/portal/invoices", "client")).toBeNull();
  });

  it("keeps internal staff out of the portal", () => {
    expect(guardRedirect("/portal", "founder")).toBe("/today");
    expect(guardRedirect("/portal/content", "manager")).toBe("/today");
  });

  it("gates finance + administration to founder/accountant", () => {
    expect(guardRedirect("/finance", "designer_social")).toBe("/today");
    expect(guardRedirect("/finance", "manager")).toBe("/today");
    expect(guardRedirect("/finance", "accountant")).toBeNull();
    expect(guardRedirect("/finance", "founder")).toBeNull();
    expect(guardRedirect("/administration", "accountant")).toBeNull();
  });

  it("gates business-plan + commercial to founder only", () => {
    expect(guardRedirect("/business-plan", "manager")).toBe("/today");
    expect(guardRedirect("/commercial", "accountant")).toBe("/today");
    expect(guardRedirect("/commercial", "founder")).toBeNull();
  });

  it("allows internal routes + sub-routes for staff", () => {
    expect(guardRedirect("/clients", "social")).toBeNull();
    expect(guardRedirect("/projects/abc/edit", "developer")).toBeNull();
    expect(guardRedirect("/content-engine/drafts/x/edit", "social")).toBeNull();
  });
});
