/**
 * A first password the founder can read aloud and the person can type once.
 *
 * The studio cannot send email yet — Supabase's built-in sender is rate
 * limited to a couple of messages an hour and no SMTP is configured — so
 * `inviteUserByEmail` is not a reliable way to give anyone a login. The
 * accountant needs one now. This is the path that does not depend on a mail
 * server existing: the founder creates the account and hands the password
 * over, and the person changes it in Settings.
 *
 * Design constraints, in order:
 *
 * 1. **Unambiguous.** It will be read over a phone or copied off a screen, so
 *    0/O, 1/l/I and 5/S are not all in the alphabet at once. A password that
 *    cannot be transcribed gets written on a post-it in a simpler form.
 * 2. **Strong anyway.** Dropping the confusable characters costs bits, so the
 *    length pays them back: 20 characters of a 26-symbol alphabet is ~94 bits,
 *    which is far past anything that matters for a credential meant to live
 *    for one login.
 * 3. **Grouped.** Four blocks of five with dashes, because that is how a human
 *    reads a string back without losing their place.
 */

// No o/0, i/l/1, s/5, u/v — the pairs people mishear or mistype. What is left
// is 26 symbols, and every one of them survives a phone call.
const ALPHABET = "abcdefghjkmnpqrtwxyz234789";

const GROUPS = 4;
const PER_GROUP = 5;

/**
 * `random` is injected so the test can assert the mapping rather than the
 * randomness. Production always gets crypto.getRandomValues.
 */
export function generateTempPassword(
  random: (n: number) => Uint8Array = cryptoBytes,
): string {
  const total = GROUPS * PER_GROUP;

  // Rejection sampling, not `% ALPHABET.length`.
  //
  // 256 is not a multiple of 26, so the modulo would make the first twenty
  // letters of the alphabet measurably likelier than the last six. It costs
  // nothing to draw again and it keeps the entropy claim above honest.
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const out: string[] = [];
  let pool = random(total * 2);
  let i = 0;
  while (out.length < total) {
    if (i >= pool.length) {
      pool = random(total);
      i = 0;
    }
    const byte = pool[i++];
    if (byte >= limit) continue;
    out.push(ALPHABET[byte % ALPHABET.length]);
  }

  return Array.from({ length: GROUPS }, (_, g) =>
    out.slice(g * PER_GROUP, (g + 1) * PER_GROUP).join(""),
  ).join("-");
}

function cryptoBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Minimum the app accepts when someone chooses their own. */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Is this an acceptable password to set?
 *
 * Length only, deliberately. Composition rules ("one uppercase, one symbol")
 * push people towards `Password1!` and are worse than the length they replace;
 * ten characters chosen freely beats eight chosen under duress.
 */
export function passwordProblem(
  password: string,
  confirmation: string,
): "tooShort" | "mismatch" | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (password !== confirmation) return "mismatch";
  return null;
}
