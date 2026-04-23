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
//   - sensitive fields are redacted by name — never add new redactable fields
//     without updating the REDACT_KEYS set

export type LogLevel = "debug" | "info" | "warn" | "error";

const REDACT_KEYS = new Set([
  "token",
  "portal_token",
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "password",
  "secret",
  "anthropic_api_key",
  "supabase_service_role_key",
  "meta_long_lived_token",
]);

function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = "[redacted]";
    } else {
      out[k] = redact(v);
    }
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
