// Typed environment access.
//
// We deliberately *don't* use zod here — it's a big dep for a small contract.
// Instead: a hand-rolled validator that groups vars by feature, surfaces
// which are missing, and returns a strongly-typed view for call sites.
//
// Usage:
//   env.supabase.url                       // required — throws on access if missing
//   env.anthropic.apiKey                   // required
//   env.meta.ok                            // boolean — safe to gate features
//   env.voyage.apiKey                      // string | null — optional
//   validateStartupEnv()                   // call once at boot to surface misconfigs

type Spec = {
  name: string;
  required: boolean;
  /** Optional predicate: extra validation beyond "is a string" */
  validate?: (v: string) => boolean;
  /** Human-readable reason when validate fails */
  reason?: string;
};

type Group = {
  label: string;
  optional: boolean; // true → whole group is optional; when all vars empty, group is "inactive"
  vars: Spec[];
};

// Keep this list aligned with .env.example. When you add a new env var,
// add it here too and in .env.example — never silently read process.env
// from a business module again.
const GROUPS: Record<string, Group> = {
  supabase: {
    label: "Supabase",
    optional: false,
    vars: [
      { name: "NEXT_PUBLIC_SUPABASE_URL", required: true },
      { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true },
      { name: "SUPABASE_SERVICE_ROLE_KEY", required: true },
    ],
  },
  app: {
    label: "App",
    optional: false,
    vars: [
      { name: "NEXT_PUBLIC_APP_URL", required: true },
      {
        name: "CRON_SECRET",
        required: true,
        validate: (v) => v.length >= 8,
        reason: "must be at least 8 characters",
      },
    ],
  },
  anthropic: {
    label: "Anthropic (Claude)",
    optional: false,
    vars: [{ name: "ANTHROPIC_API_KEY", required: true }],
  },
  meta: {
    label: "Meta Graph API (Instagram)",
    optional: true,
    vars: [
      { name: "META_LONG_LIVED_TOKEN", required: true },
      { name: "INSTAGRAM_BUSINESS_ACCOUNT_ID", required: true },
    ],
  },
  voyage: {
    label: "Voyage AI (embeddings)",
    optional: true,
    vars: [{ name: "VOYAGE_API_KEY", required: true }],
  },
  google: {
    label: "Google OAuth",
    optional: true,
    vars: [
      { name: "GOOGLE_OAUTH_CLIENT_ID", required: true },
      { name: "GOOGLE_OAUTH_CLIENT_SECRET", required: true },
    ],
  },
};

export type EnvIssue = {
  group: string;
  name: string;
  kind: "missing" | "invalid";
  reason?: string;
};

export type EnvReport = {
  ok: boolean;
  missingRequired: EnvIssue[];
  invalid: EnvIssue[];
  inactiveOptional: string[]; // optional groups whose vars are all empty
};

function read(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Audit the entire env surface. Returns a report; call sites decide whether
 * to throw (boot-critical) or warn (optional features off).
 */
export function auditEnv(): EnvReport {
  const missingRequired: EnvIssue[] = [];
  const invalid: EnvIssue[] = [];
  const inactiveOptional: string[] = [];

  for (const [groupKey, group] of Object.entries(GROUPS)) {
    const values = group.vars.map((v) => ({ spec: v, value: read(v.name) }));
    const allEmpty = values.every((x) => !x.value);

    if (group.optional && allEmpty) {
      inactiveOptional.push(groupKey);
      continue;
    }

    for (const { spec, value } of values) {
      if (!value && spec.required) {
        missingRequired.push({
          group: groupKey,
          name: spec.name,
          kind: "missing",
        });
        continue;
      }
      if (value && spec.validate && !spec.validate(value)) {
        invalid.push({
          group: groupKey,
          name: spec.name,
          kind: "invalid",
          reason: spec.reason,
        });
      }
    }
  }

  return {
    ok: missingRequired.length === 0 && invalid.length === 0,
    missingRequired,
    invalid,
    inactiveOptional,
  };
}

/**
 * Call on app boot (e.g., from a route handler or instrumentation). Throws a
 * human-readable error if required env is missing or invalid. Emits a warning
 * summary for inactive-optional groups so operators know which features are
 * inert.
 */
export function validateStartupEnv(): void {
  const report = auditEnv();
  if (!report.ok) {
    const lines = [
      "Environment validation failed.",
      ...report.missingRequired.map(
        (i) => `  - MISSING: ${i.name} (${i.group})`,
      ),
      ...report.invalid.map(
        (i) =>
          `  - INVALID: ${i.name} (${i.group})${i.reason ? ` — ${i.reason}` : ""}`,
      ),
    ];
    throw new Error(lines.join("\n"));
  }
  if (report.inactiveOptional.length > 0) {
    console.warn(
      `[env] Optional feature groups inactive (empty env): ${report.inactiveOptional.join(", ")}`,
    );
  }
}

/**
 * Typed view of env groups. Reads lazily — access `env.meta.ok` without
 * ever touching the actual token, so importing this file from the client
 * doesn't leak secrets. (In practice, don't import from client components.)
 */
export const env = {
  supabase: {
    get url() {
      return requireRead("NEXT_PUBLIC_SUPABASE_URL");
    },
    get anonKey() {
      return requireRead("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    },
    get serviceRoleKey() {
      return requireRead("SUPABASE_SERVICE_ROLE_KEY");
    },
  },
  app: {
    get url() {
      return read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
    },
    get cronSecret() {
      return read("CRON_SECRET") ?? null;
    },
  },
  anthropic: {
    get apiKey() {
      return read("ANTHROPIC_API_KEY") ?? null;
    },
  },
  meta: {
    get token() {
      return read("META_LONG_LIVED_TOKEN") ?? null;
    },
    get igAccountId() {
      return read("INSTAGRAM_BUSINESS_ACCOUNT_ID") ?? null;
    },
    get ok() {
      return !!(
        read("META_LONG_LIVED_TOKEN") && read("INSTAGRAM_BUSINESS_ACCOUNT_ID")
      );
    },
  },
  voyage: {
    get apiKey() {
      return read("VOYAGE_API_KEY") ?? null;
    },
    get ok() {
      return !!read("VOYAGE_API_KEY");
    },
  },
  google: {
    get clientId() {
      return read("GOOGLE_OAUTH_CLIENT_ID") ?? null;
    },
    get clientSecret() {
      return read("GOOGLE_OAUTH_CLIENT_SECRET") ?? null;
    },
    get ok() {
      return !!(
        read("GOOGLE_OAUTH_CLIENT_ID") && read("GOOGLE_OAUTH_CLIENT_SECRET")
      );
    },
  },
};

function requireRead(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}
