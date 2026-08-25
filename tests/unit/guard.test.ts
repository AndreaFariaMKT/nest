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
    expect(mapLegacyRole("staff")).toBe("manager");
  });

  it("fails closed on a role nobody planned for", () => {
    // null is what a user with NO tenant_members row for the active tenant
    // produces. This used to answer "manager", which carries coordinate +
    // publish — so such a login was handed the capability to register
    // publishing credentials. RLS denied everything behind it, but that was
    // the only layer and it does not cover `profiles`.
    expect(mapLegacyRole(null)).toBe("client");
    expect(mapLegacyRole(undefined)).toBe("client");
    expect(mapLegacyRole("something-nobody-wrote")).toBe("client");
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

  it("gates commercial to founder only", () => {
    expect(guardRedirect("/commercial", "accountant")).toBe("/today");
    expect(guardRedirect("/commercial", "founder")).toBeNull();
  });

  it("allows internal routes + sub-routes for staff", () => {
    expect(guardRedirect("/clients", "social")).toBeNull();
    expect(guardRedirect("/projects/abc/edit", "developer")).toBeNull();
    expect(guardRedirect("/content-engine/drafts/x/edit", "social")).toBeNull();
  });

  // The social media module. The prefix's role list is derived from
  // socialCaps(), so these cases fail the moment the two drift apart.
  it("lets the module's roles into the screens that are theirs", () => {
    for (const role of ["founder", "manager", "social"] as const) {
      expect(guardRedirect("/social", role)).toBeNull();
      expect(guardRedirect("/social/backlog", role)).toBeNull();
    }
    // Everyone the module admits reaches their own waiting list and a piece
    // record; the record renders per-capability panels of its own.
    for (const role of ["founder", "manager", "social", "designer_social"] as const) {
      expect(guardRedirect("/social/waiting", role)).toBeNull();
      expect(guardRedirect("/social/pieces/abc-123", role)).toBeNull();
    }
  });

  it("holds each screen to the capabilities it declares", () => {
    // This is the whole point of the per-screen check. A designer holds
    // `design` only: production, the calendar and the media library are
    // theirs; the shelf, the order, the shared logins and the client health
    // overview are not. Before, the prefix was open to any role with any
    // social capability, so typing the path was enough.
    expect(guardRedirect("/social/production", "designer_social")).toBeNull();
    expect(guardRedirect("/social/calendar", "designer_social")).toBeNull();
    expect(guardRedirect("/social/media", "designer_social")).toBeNull();

    for (const path of [
      "/social",
      "/social/backlog",
      "/social/fortnight",
      "/social/publishing",
      "/social/logins",
      "/social/accounts",
      "/social/report",
    ]) {
      expect(guardRedirect(path, "designer_social")).toBe("/social/waiting");
    }
  });

  it("bounces to the role's own first screen, not out of the module", () => {
    // Being thrown to /today for opening one wrong page reads as losing
    // access to all of it — and the target has to be somewhere that role can
    // actually reach, or the redirect loops.
    const target = guardRedirect("/social/backlog", "designer_social");
    expect(target).toBe("/social/waiting");
    expect(guardRedirect(target as string, "designer_social")).toBeNull();
  });

  it("denies a path under /social that is not a screen at all", () => {
    // Fails closed: a screen added without a thought about who may see it is
    // denied rather than open.
    expect(guardRedirect("/social/not-a-screen", "social")).toBe(
      "/social",
    );
  });

  it("keeps roles outside the module out of it", () => {
    for (const role of ["accountant", "developer", "designer_identity"] as const) {
      expect(guardRedirect("/social", role)).toBe("/today");
      expect(guardRedirect("/social/logins", role)).toBe("/today");
    }
  });

  it("sends a client to the portal rather than into the module", () => {
    expect(guardRedirect("/social", "client")).toBe("/portal");
  });

  it("does not match a route that merely starts with the same letters", () => {
    expect(guardRedirect("/socialise", "accountant")).toBeNull();
  });
});
