-- ═══════════════════════════════════════════════════════════════════════════
-- Nest · content_drafts.compliance_report
--
--   Claude-driven compliance check per draft. JSONB column stores the full
--   structured findings so we can render severity + issues inline without a
--   second Claude call.
--
--   Shape:
--     { severity: 'ok' | 'warning' | 'block',
--       summary: string,
--       issues: [{ rule, location, description, severity }],
--       checked_at: ISO8601,
--       model: string }
-- ═══════════════════════════════════════════════════════════════════════════

alter table content_drafts
  add column if not exists compliance_report jsonb;
