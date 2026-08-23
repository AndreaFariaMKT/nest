// Structured logger.
//
// In production: emits a single-line JSON blob per log event — friendly for
// Vercel log aggregation, Sentry integrations, or future ELK / Datadog.
// In development: pretty-prints with a colored level tag.
//
// Conventions:
//   - `area` identifies the feature ("cron.publish", "content-engine.adapt")
//   - `msg` is a short human-readable sentence
//   - all other context fields are serialized as JSON
//   - sensitive fields are redacted by name — matched as substrings, so
//     `google_refresh_token` and `secret_enc` are covered without listing
//     every spelling. Add a pattern, not a name.
//   - pass the CODE, never a whole PostgrestError or GoTrue error: their
//     `details` echo the offending value, which is how a token or part of a
//     message body ends up in a log line.

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Field names whose values never reach a log line.
 *
 * Matched as SUBSTRINGS, not exact names. The exact-match version was
 * technically accurate and materially incomplete for the columns this app
 * actually moves around: `google_refresh_token` and `google_access_token` did
 * not match bare `refresh_token` / `access_token`, and calendar-mirror and
 * transcript-pull select exactly those names. Nor did `secret_enc`, `iv`,
 * `senha`, `client_secret`, or any camelCase spelling of any of them.
 */
const REDACT_PATTERNS = [
  "token",
  "secret",
  "password",
  "senha",
  "cookie",
  "authorization",
  "apikey",
  "api_key",
  "credential",
  "_enc",
  "email",
  "phone",
  "telefone",
  "cpf",
  "cnpj",
] as const;

/** Depth cap. `redact` used to recurse without one, so passing a Supabase
 *  client or a Request as context overflowed the stack inside the logger —
 *  turning a log line into the thing that took the request down. */
const MAX_DEPTH = 6;

function isSensitive(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z_]/g, "");
  return REDACT_PATTERNS.some((p) => k.includes(p));
}

/** Exported for tests. Callers use `log.*`, which applies this. */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[depth]";
  // Cycles reach here through anything holding a reference back to itself —
  // an Error with a `cause` chain, a Supabase client, a Next Request.
  if (seen.has(value as object)) return "[circular]";
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1, seen));

  // An Error serializes to `{}` through Object.entries, which is how a real
  // failure becomes an empty log line.
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitive(k) ? "[redacted]" : redact(v, depth + 1, seen);
  }
  return out;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel()];
}

type LogContext = Record<string, unknown>;

function emit(level: LogLevel, area: string, msg: string, ctx: LogContext) {
  if (!shouldEmit(level)) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    area,
    msg,
    ...((redact(ctx) ?? {}) as LogContext),
  };

  // Mirror errors to Sentry when DSN is set. Fire-and-forget; never block
  // the log caller on Sentry I/O. Import is dynamic so the log module
  // stays tree-shakable in runtimes that don't use Sentry.
  if (level === "error" && process.env.SENTRY_DSN) {
    import("./sentry")
      .then(({ captureMessage }) => {
        const err = ctx.err;
        void captureMessage(`${area}: ${msg}`, {
          level: "error",
          tags: { area },
          extra: {
            ...(redact(ctx) as Record<string, unknown>),
            err: typeof err === "string" ? err : err instanceof Error ? err.message : undefined,
          },
        });
      })
      .catch(() => {});
  }

  if (isProd()) {
    // Single-line JSON — optimized for log aggregators.
    const line = JSON.stringify(payload);
    const sink =
      level === "error" || level === "warn" ? console.error : console.log;
    sink(line);
    return;
  }

  // Dev: pretty output. Keep it scannable at a glance.
  const color = {
    debug: "\x1b[90m", // grey
    info: "\x1b[36m", // cyan
    warn: "\x1b[33m", // yellow
    error: "\x1b[31m", // red
  }[level];
  const reset = "\x1b[0m";
  const tag = `${color}[${level.toUpperCase()}]${reset}`;
  const ctxStr =
    Object.keys(ctx).length > 0 ? " " + JSON.stringify(redact(ctx)) : "";
  const line = `${tag} ${area}: ${msg}${ctxStr}`;
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const log = {
  debug(area: string, msg: string, ctx: LogContext = {}) {
    emit("debug", area, msg, ctx);
  },
  info(area: string, msg: string, ctx: LogContext = {}) {
    emit("info", area, msg, ctx);
  },
  warn(area: string, msg: string, ctx: LogContext = {}) {
    emit("warn", area, msg, ctx);
  },
  error(area: string, msg: string, ctx: LogContext = {}) {
    emit("error", area, msg, ctx);
  },
  /**
   * Wrap an async function to log entry + exit + elapsed ms. The return
   * value is passed through unchanged; thrown errors are re-raised after
   * being logged.
   */
  async timed<T>(
    area: string,
    msg: string,
    fn: () => Promise<T>,
    ctx: LogContext = {},
  ): Promise<T> {
    const started = Date.now();
    try {
      const result = await fn();
      emit("info", area, `${msg} · ok`, {
        ...ctx,
        elapsedMs: Date.now() - started,
      });
      return result;
    } catch (err) {
      emit("error", area, `${msg} · fail`, {
        ...ctx,
        elapsedMs: Date.now() - started,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
};
