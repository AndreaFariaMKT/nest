// Input sanitization helpers for user-submitted text.
//
// Nest stores raw user input (approval comments, draft fields, task
// descriptions) in Postgres text columns. All rendering uses React, so XSS
// via `<script>` insertion is already blocked by React's auto-escaping.
// These helpers defend against the *other* failure modes we actually see:
//   1. Invisible / control characters (NULL, RTL override, zero-width joiners)
//      that break display and log searching.
//   2. Oversized pastes that bloat the DB and Claude prompts.
//   3. Repeated-whitespace spam that inflates token counts.
//
// These are PURE — no network, no file IO. Keep them that way.

/** Strip NULL bytes, C0 control chars (except \n \r \t), and BOMs. */
export function stripControlChars(input: string): string {
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      // BOM + common zero-width / bidi-override characters that show up in
      // copy-paste from PDFs and malicious inputs.
      .replace(/[\uFEFF\u200B-\u200F\u202A-\u202E]/g, "")
  );
}

/** Collapse runs of whitespace (spaces, tabs) to a single space per line. */
export function collapseInlineWhitespace(input: string): string {
  return input
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/\s+$/, ""))
    .join("\n");
}

/** Limit consecutive blank lines to at most `max` (default 2). */
export function limitBlankLines(input: string, max = 2): string {
  const pattern = new RegExp(`\\n{${max + 1},}`, "g");
  return input.replace(pattern, "\n".repeat(max + 1));
}

export type CleanTextOptions = {
  /** Trim leading/trailing whitespace. Default true. */
  trim?: boolean;
  /** Max total length (characters). Extra is dropped. Default: no limit. */
  maxLength?: number;
  /** Max consecutive blank lines. Default 2. */
  maxBlankLines?: number;
};

/**
 * Pipeline: strip control chars → collapse whitespace → limit blank lines →
 * optional trim + truncate.
 */
export function cleanText(
  input: string,
  opts: CleanTextOptions = {},
): string {
  let out = stripControlChars(input);
  out = collapseInlineWhitespace(out);
  out = limitBlankLines(out, opts.maxBlankLines ?? 2);
  if (opts.trim !== false) out = out.trim();
  if (opts.maxLength && out.length > opts.maxLength) {
    out = out.slice(0, opts.maxLength);
  }
  return out;
}

/**
 * Stricter variant for single-line inputs (titles, hashtags). Drops \n and \r
 * and collapses any remaining whitespace to single spaces.
 */
export function cleanLine(input: string, maxLength?: number): string {
  const stripped = stripControlChars(input).replace(/[\r\n]+/g, " ");
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  if (maxLength && collapsed.length > maxLength) {
    return collapsed.slice(0, maxLength);
  }
  return collapsed;
}

// ───────────────────────────────────────────────────────────────────────────
// Speaker pseudonymisation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Replace speaker names in a transcript with stable labels.
 *
 * Meeting transcripts are the highest-risk data this platform holds: verbatim
 * speech, attributed by name, of people who never signed up for anything — a
 * client's staff, a supplier on the call, whoever was in the room. Nest sends
 * them to Anthropic to write carousels and to Voyage to embed, and prompt
 * caching means what goes there persists.
 *
 * Sending them is the product; sending the NAMES is not. Nothing downstream
 * needs to know who said a line — the model is looking for what the business
 * decided, not who decided it. `entriesToPlainText` already writes one
 * `Name: text` line per utterance (google-meet.ts), so the structure to strip
 * is already there.
 *
 * Deterministic within a transcript: the same speaker is the same label
 * throughout, so who-agreed-with-whom survives while the identity does not.
 * Not deterministic ACROSS transcripts, on purpose — a stable pseudonym that
 * followed someone between meetings would be an identifier again.
 *
 * Only touches the speaker position at the start of a line. Names spoken
 * inside a sentence are not reachable by shape and are not claimed to be
 * removed — this shrinks the exposure, it does not eliminate it.
 */
export function pseudonymiseSpeakers(transcript: string): string {
  const labels = new Map<string, string>();
  const labelFor = (name: string): string => {
    const existing = labels.get(name);
    if (existing) return existing;
    const next = `Speaker ${indexToLetters(labels.size)}`;
    labels.set(name, next);
    return next;
  };

  return transcript
    .split("\n")
    .map((line) => {
      // `Name: said something`. Bounded name length so a sentence that merely
      // contains a colon ("the plan is this: ship on Friday") is left alone.
      const m = /^([^:\n]{1,40}):\s(.*)$/.exec(line);
      if (!m) return line;
      return `${labelFor(m[1].trim())}: ${m[2]}`;
    })
    .join("\n");
}

/** 0 → A, 25 → Z, 26 → AA. Keeps labels short for the common case. */
function indexToLetters(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}
