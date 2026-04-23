import { describe, expect, it } from "vitest";
import {
  buildComplianceSystem,
  buildComplianceUser,
  ComplianceParseError,
  detectDomains,
  parseComplianceReport,
} from "@/lib/compliance";

describe("detectDomains", () => {
  it("classifies financial industry", () => {
    expect(detectDomains("Financial advisory")).toEqual(["financial"]);
    expect(detectDomains("mercado de investimentos")).toEqual(["financial"]);
    expect(detectDomains("Consultoria financeira")).toEqual(["financial"]);
  });

  it("classifies legal industry", () => {
    expect(detectDomains("Advocacia tributária")).toEqual(["legal"]);
    expect(detectDomains("Direito empresarial")).toEqual(["legal"]);
  });

  it("classifies health industry", () => {
    expect(detectDomains("Clínica de nutrição")).toEqual(["health"]);
    expect(detectDomains("Médica dermato")).toEqual(["health"]);
  });

  it("returns 'general' when no hint matches", () => {
    expect(detectDomains("Architecture studio")).toEqual(["general"]);
    expect(detectDomains(null)).toEqual(["general"]);
    expect(detectDomains("")).toEqual(["general"]);
  });

  it("stacks domains when multiple apply", () => {
    expect(detectDomains("Financial legal consultant")).toEqual([
      "financial",
      "legal",
    ]);
  });
});

describe("buildComplianceSystem", () => {
  it("always includes LGPD", () => {
    expect(buildComplianceSystem(["general"])).toContain("LGPD");
  });

  it("includes CVM for financial", () => {
    expect(buildComplianceSystem(["financial"])).toContain("CVM");
    expect(buildComplianceSystem(["financial"])).toContain(
      "Rentabilidade passada",
    );
  });

  it("includes OAB for legal", () => {
    expect(buildComplianceSystem(["legal"])).toContain("OAB");
    expect(buildComplianceSystem(["legal"])).toContain("205/2021");
  });

  it("includes ANVISA for health", () => {
    expect(buildComplianceSystem(["health"])).toContain("ANVISA");
  });

  it("requires raw JSON output (no fences)", () => {
    expect(buildComplianceSystem(["general"])).toMatch(/no markdown fences/i);
  });
});

describe("buildComplianceUser", () => {
  it("serializes draft + client for review", () => {
    const user = buildComplianceUser(
      {
        title: "Investe sem medo",
        pillar: "Investimentos",
        hook: "Rendimento garantido de 20%!",
        caption: "Compre agora.",
        hashtags: ["#investir"],
        slides: [{ headline: "Sem risco", body: "100% certo" }],
      },
      { name: "Nayara", industry: "financial advisory" },
    );
    expect(user).toContain("Client: Nayara");
    expect(user).toContain("industry: financial advisory");
    expect(user).toContain("title: Investe sem medo");
    expect(user).toContain("Slide 1:");
    expect(user).toContain("Sem risco");
  });
});

describe("parseComplianceReport", () => {
  it("parses a well-formed 'ok' response", () => {
    const raw = JSON.stringify({
      severity: "ok",
      summary: "Tudo certo.",
      issues: [],
    });
    const r = parseComplianceReport(raw, "claude-haiku-4-5");
    expect(r.severity).toBe("ok");
    expect(r.issues).toEqual([]);
    expect(r.model).toBe("claude-haiku-4-5");
  });

  it("keeps structured issues and picks the worst severity", () => {
    const raw = JSON.stringify({
      severity: "warning",
      summary: "3 problemas encontrados",
      issues: [
        {
          rule: "CVM Res. 20",
          location: "slide 2",
          description: "Promete retorno fixo",
          severity: "block",
        },
        {
          rule: "LGPD art. 7",
          location: "caption",
          description: "Cita e-mail",
          severity: "warning",
        },
      ],
    });
    const r = parseComplianceReport(raw, "claude-haiku-4-5");
    expect(r.severity).toBe("block"); // elevated from warning due to block issue
    expect(r.issues).toHaveLength(2);
  });

  it("forces severity to 'ok' when issues array is empty", () => {
    const raw = JSON.stringify({
      severity: "warning",
      summary: "nada na real",
      issues: [],
    });
    expect(parseComplianceReport(raw, "m").severity).toBe("ok");
  });

  it("strips markdown fences", () => {
    const payload = JSON.stringify({ severity: "ok", summary: "x", issues: [] });
    expect(
      parseComplianceReport("```json\n" + payload + "\n```", "m").severity,
    ).toBe("ok");
  });

  it("throws on empty or non-JSON", () => {
    expect(() => parseComplianceReport("", "m")).toThrow(ComplianceParseError);
    expect(() => parseComplianceReport("no way", "m")).toThrow(
      ComplianceParseError,
    );
  });

  it("filters out malformed issue entries", () => {
    const raw = JSON.stringify({
      severity: "warning",
      summary: "um problema",
      issues: [
        { rule: "", description: "sem rule" },
        { rule: "ok rule", description: "" },
        {
          rule: "LGPD",
          location: "caption",
          description: "uma descrição válida",
          severity: "warning",
        },
      ],
    });
    const r = parseComplianceReport(raw, "m");
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].rule).toBe("LGPD");
  });
});
