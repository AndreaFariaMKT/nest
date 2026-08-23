/**
 * Turning a Postgres failure into something safe to show a person.
 *
 * The module's instinct here was right — a refusal must say WHY, and swallowing
 * a real failure behind a friendly noise word is how a queue stalls on a silent
 * "no". What was wrong was the granularity: `error.message` verbatim reaches
 * the browser, and portal clients drive their own transitions, so a client
 * could read `new row violates row-level security policy for table
 * "content_drafts"` — table names, column names, constraint names, enum type
 * names and PostgREST internals, handed to someone outside the studio.
 *
 * The code is the stable part. SQLSTATE does not change between releases, it
 * carries no identifiers, and there are only a handful worth distinguishing.
 * Everything else collapses to one key, and the detail goes to the log where
 * whoever is debugging can actually reach it.
 */

/** The refusals this module can name. Extends `social.blocked.*`. */
export const DB_ERRORS = [
  "dbDenied",
  "dbDuplicate",
  "dbMissingField",
  "dbBadReference",
  "dbTooLong",
  "dbFailed",
] as const;

export type DbError = (typeof DB_ERRORS)[number];

export function isDbError(v: string): v is DbError {
  return (DB_ERRORS as readonly string[]).includes(v);
}

/** What PostgREST hands back on a failed write. */
export interface PgLikeError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** SQLSTATE is stable across releases and carries no identifiers. */
const BY_SQLSTATE: Record<string, DbError> = {
  "42501": "dbDenied", // insufficient_privilege
  "23505": "dbDuplicate", // unique_violation
  "23502": "dbMissingField", // not_null_violation
  "23503": "dbBadReference", // foreign_key_violation
  "23514": "dbMissingField", // check_violation — a value the row may not hold
  "22001": "dbTooLong", // string_data_right_truncation
  "22007": "dbMissingField", // invalid_datetime_format
  "22008": "dbMissingField", // datetime_field_overflow
  "42703": "dbFailed", // undefined_column — a deploy problem, not a user one
  PGRST116: "dbFailed", // no rows where exactly one was expected
};

/**
 * Map a write failure to a translatable key.
 *
 * Pure, and deliberately does no logging: `isDbError` is needed by the client
 * component that renders the refusal, so this module ends up in the browser
 * bundle. Pulling `log.ts` in with it would drag the Sentry envelope client
 * along for a predicate. Callers log — they are on the server and they know
 * their own area, and they log the CODE, never the message: a `value too long`
 * echoes part of the value, and a unique violation echoes the conflicting one.
 */
export function dbError(err: PgLikeError): DbError {
  return (err.code ? BY_SQLSTATE[err.code] : undefined) ?? "dbFailed";
}
