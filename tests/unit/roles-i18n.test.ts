import { describe, it, expect } from "vitest";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";
// app-roles, not roles: the latter imports React icon components.
import { APP_ROLES } from "@/lib/app-roles";

/**
 * The team screen renders a role from a dynamic key — `t(`appRoles.${r}`)` —
 * for every value in APP_ROLES, in a `<select>` that assigns it. TypeScript
 * cannot see those keys and next-intl throws at render, so adding a ninth role
 * without its strings should fail here rather than on the one screen that
 * hands out permissions.
 */
describe("role labels", () => {
  for (const [name, dict] of [
    ["en", en],
    ["pt-BR", ptBR],
  ] as const) {
    it(`${name} names every app role`, () => {
      const labels = (dict.team as { appRoles: Record<string, string> })
        .appRoles;
      for (const role of APP_ROLES) {
        expect(labels[role], `${name} · team.appRoles.${role}`).toBeTruthy();
      }
    });
  }
});

/**
 * Roadmap notes are for the roadmap.
 *
 * Three screens shipped with sprint numbers in their user-facing copy — the
 * home screen told the owner a feature "wires up in Sprint 7" at every login,
 * and two others promised integrations that had since been built. A string
 * that describes the plan instead of the product is a bug with a long
 * half-life, because nothing fails when the plan changes.
 */
describe("user-facing copy", () => {
  for (const [name, dict] of [
    ["en", en],
    ["pt-BR", ptBR],
  ] as const) {
    it(`${name} carries no sprint or roadmap language`, () => {
      const offenders: string[] = [];
      const walk = (node: unknown, path: string) => {
        if (typeof node === "string") {
          if (/\bsprint\b/i.test(node)) offenders.push(`${path}: ${node}`);
          return;
        }
        if (node && typeof node === "object") {
          for (const [k, v] of Object.entries(node)) {
            walk(v, path ? `${path}.${k}` : k);
          }
        }
      };
      walk(dict, "");
      expect(offenders).toEqual([]);
    });
  }
});
