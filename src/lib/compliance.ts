// Compliance check — Claude reviews a carousel draft for Brazilian regulatory
// and legal risks (CVM for financial content, OAB for legal, LGPD for privacy).
// Lives as pure helpers so we can unit-test the prompt shape + the response
// parser without paying Claude for every test.

import type { SlideDraft } from "@/lib/carousel-prompt";

export type ComplianceSeverity = "ok" | "warning" | "block";

export type ComplianceIssue = {
  rule: string;
  location: string;
  description: string;
  severity: ComplianceSeverity;
};

export type ComplianceReport = {
  severity: ComplianceSeverity;
  summary: string;
  issues: ComplianceIssue[];
  checkedAt: string;
  model: string;
};

export type DraftForCompliance = {
  title: string;
  pillar: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  slides: SlideDraft[];
};

export type ClientForCompliance = {
  name: string;
  industry: string | null;
};

// ───────────────────────────────────────────────────────────────────────────
// Industry detection (pure)
// ───────────────────────────────────────────────────────────────────────────

export type ComplianceDomain =
  | "financial"
  | "legal"
  | "health"
  | "general";

const FINANCIAL_HINTS = [
  "financ",
  "invest",
  "banc",
  "economi",
  "mercad",
  "fundo",
  "renda fix",
  "ações",
  "acoes",
  "wealth",
  "crypto",
  "cripto",
];
const LEGAL_HINTS = ["advoc", "advog", "jurid", "legal", "direit", "law firm"];
const HEALTH_HINTS = [
  "saud",
  "health",
  "médic",
  "medic",
  "clínic",
  "clinic",
  "nutri",
  "pharm",
];

export function detectDomains(industry: string | null): ComplianceDomain[] {
  if (!industry) return ["general"];
  const lower = industry.toLowerCase();
  const domains: ComplianceDomain[] = [];
  if (FINANCIAL_HINTS.some((h) => lower.includes(h))) domains.push("financial");
  if (LEGAL_HINTS.some((h) => lower.includes(h))) domains.push("legal");
  if (HEALTH_HINTS.some((h) => lower.includes(h))) domains.push("health");
  if (domains.length === 0) domains.push("general");
  return domains;
}

// ───────────────────────────────────────────────────────────────────────────
// Prompt construction (pure)
// ───────────────────────────────────────────────────────────────────────────

const DOMAIN_RULES: Record<ComplianceDomain, string> = {
  financial:
    "CVM (Comissão de Valores Mobiliários — Brazil): the post is marketing, not investment advice. No promises of guaranteed returns. No claims like 'lucro certo' or 'sem risco'. Specific asset recommendations require explicit disclaimers. 'Rentabilidade passada não garante rentabilidade futura' must appear when citing historical returns. No unlicensed 'consultoria de investimento'. Resolution CVM 20 and CVM 39 are the key references.",
  legal:
    "OAB (Ordem dos Advogados do Brasil): advertising restrictions under Provimento 205/2021. Lawyers cannot 'captar clientela' or make promises about case outcomes. No testimonials from clients. No mention of ongoing cases with identifying details. Fees must never appear publicly. No self-promoting superlatives ('melhor', 'mais qualificado').",
  health:
    "CFM / ANVISA / Conselhos profissionais: health content must not promise cures, before/after without consent, or substitute professional consultation. Avoid diagnosis-style statements. No minimum efficacy guarantees. Health claims about products need ANVISA registration reference when applicable.",
  general:
    "General Brazilian consumer protection (CDC): no misleading advertising, no false scarcity, no deceptive endorsements. Influencer content must disclose paid partnerships (#publi, #parceria). No 'cura milagrosa' language.",
};

const LGPD_RULE =
  "LGPD (Lei Geral de Proteção de Dados): posts must not include personal data (names, emails, phones, addresses, CPF) of third parties without consent. Screenshots of DMs / WhatsApp conversations are risky. Case studies must anonymize or have explicit written consent.";

export function buildComplianceSystem(domains: ComplianceDomain[]): string {
  const ruleBlocks = domains
    .map((d, i) => `${i + 1}. ${d.toUpperCase()}: ${DOMAIN_RULES[d]}`)
    .concat([`${domains.length + 1}. LGPD (ALWAYS APPLIES): ${LGPD_RULE}`])
    .join("\n\n");

  return `You are a Brazilian compliance reviewer for a marketing agency. Review the carousel draft against the rules below and emit a structured JSON report.

Rules in scope:

${ruleBlocks}

Output format: raw JSON only, no markdown fences, no prose.

Shape:
{
  "severity": "ok" | "warning" | "block",
  "summary": "one-line overview in Portuguese (Brazil) — max 140 chars",
  "issues": [
    {
      "rule": "short citation, e.g. 'CVM Res. 20/2021' or 'LGPD art. 7'",
      "location": "e.g. 'slide 3' | 'caption' | 'hashtags' | 'hook'",
      "description": "one paragraph in Portuguese explaining the concern and how to fix it",
      "severity": "warning" | "block"
    }
  ]
}

Severity rubric:
- "block" — publishing would create real legal/regulatory exposure. Common: CVM promises of returns, OAB testimonials, LGPD personal-data leaks, ANVISA unregistered health claims.
- "warning" — risky framing that should be softened but not illegal by itself.
- "ok" (at the top level, with an empty issues array) — nothing flags.

Be direct, practical, and short. Don't invent issues to fill space.`;
}

export function buildComplianceUser(
  draft: DraftForCompliance,
  client: ClientForCompliance,
): string {
  const slidesText = draft.slides
    .map(
      (s, i) =>
        `Slide ${i + 1}:\n  headline: ${s.headline ?? ""}\n  body: ${s.body ?? ""}`,
    )
    .join("\n\n");
  return `Client: ${client.name}${client.industry ? ` · industry: ${client.industry}` : ""}

<draft>
title: ${draft.title}
pillar: ${draft.pillar ?? ""}
hook: ${draft.hook ?? ""}
caption: ${draft.caption ?? ""}
hashtags: ${draft.hashtags.join(" ")}

${slidesText}
</draft>

Return the JSON compliance report now.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Response parsing (pure)
// ───────────────────────────────────────────────────────────────────────────

export class ComplianceParseError extends Error {}

const SEVERITIES: ComplianceSeverity[] = ["ok", "warning", "block"];

export function parseComplianceReport(
  raw: string,
  model: string,
): Omit<ComplianceReport, "checkedAt"> & { checkedAt?: string } {
  const stripped = raw
    .replace(/^\s*```(?:json|JSON)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
  if (!stripped) throw new ComplianceParseError("empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new ComplianceParseError("not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ComplianceParseError("top level must be an object");
  }
  const root = parsed as Record<string, unknown>;

  const rawSeverity =
    typeof root.severity === "string" ? root.severity.toLowerCase() : "";
  const severity: ComplianceSeverity = (
    SEVERITIES as string[]
  ).includes(rawSeverity)
    ? (rawSeverity as ComplianceSeverity)
    : "warning";

  const summary =
    typeof root.summary === "string" ? root.summary.trim() : "";

  const issuesRaw = Array.isArray(root.issues) ? root.issues : [];
  const issues: ComplianceIssue[] = [];
  for (const raw of issuesRaw) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const rule = typeof row.rule === "string" ? row.rule.trim() : "";
    const location =
      typeof row.location === "string" ? row.location.trim() : "";
    const description =
      typeof row.description === "string" ? row.description.trim() : "";
    if (!rule || !description) continue;
    const rawSev =
      typeof row.severity === "string" ? row.severity.toLowerCase() : "warning";
    const issueSev: ComplianceSeverity = (SEVERITIES as string[]).includes(
      rawSev,
    )
      ? (rawSev as ComplianceSeverity)
      : "warning";
    issues.push({
      rule,
      location: location || "draft",
      description,
      severity: issueSev,
    });
  }

  // If Claude said "ok" but included issues, elevate to the worst issue severity.
  let finalSeverity = severity;
  if (issues.length > 0) {
    const hasBlock = issues.some((i) => i.severity === "block");
    const hasWarning = issues.some((i) => i.severity === "warning");
    finalSeverity = hasBlock ? "block" : hasWarning ? "warning" : "ok";
  } else if (severity !== "ok") {
    // No issues → force "ok"
    finalSeverity = "ok";
  }

  return {
    severity: finalSeverity,
    summary: summary || (finalSeverity === "ok" ? "Nada a sinalizar." : ""),
    issues,
    model,
  };
}
