/**
 * Which Supabase project a URL and a key each belong to.
 *
 * A key from the wrong project is indistinguishable from a broken database by
 * every signal the app has: the variable is present, it has the right shape,
 * `auditEnv` passes it, and the query simply fails. The cutover to São Paulo
 * ended with NEXT_PUBLIC_SUPABASE_URL and the anon key pointing at the new
 * project and SUPABASE_SERVICE_ROLE_KEY still holding the old one — and the
 * only symptom, for hours, was `db.ok: false`.
 *
 * Comparing the two is one string comparison and turns that into a sentence
 * that says what to fix.
 */

/** The project ref in `https://<ref>.supabase.co`, or null. */
export function refFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\./.exec(url.trim());
  return m ? m[1] : null;
}

/**
 * The project ref a legacy JWT key was issued for.
 *
 * Returns null for the newer `sb_secret_…` / `sb_publishable_…` keys, which
 * carry no readable claims — there the mismatch cannot be detected this way,
 * and saying nothing is better than guessing.
 *
 * Only the `ref` claim is read. The signature is not verified and does not
 * need to be: this answers "which project is this key for", not "is this key
 * valid" — the database already answers the second question.
 */
export function refFromKey(key: string | undefined): string | null {
  if (!key || !key.startsWith("eyJ")) return null;
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const pad = parts[1].padEnd(
      parts[1].length + ((4 - (parts[1].length % 4)) % 4),
      "=",
    );
    const json = JSON.parse(
      Buffer.from(pad, "base64").toString("utf8"),
    ) as { ref?: unknown };
    return typeof json.ref === "string" ? json.ref : null;
  } catch {
    return null;
  }
}

export type KeyMismatch = { variable: string; keyRef: string; urlRef: string };

/**
 * Every configured key that names a different project than the URL does.
 *
 * Unknown refs — a new-format key, a malformed one — are left out rather than
 * reported as mismatches. A false alarm here would send someone to rotate a
 * key that was fine.
 */
export function keyMismatches(
  url: string | undefined,
  keys: ReadonlyArray<{ variable: string; value: string | undefined }>,
): KeyMismatch[] {
  const urlRef = refFromUrl(url);
  if (!urlRef) return [];
  const out: KeyMismatch[] = [];
  for (const { variable, value } of keys) {
    const keyRef = refFromKey(value);
    if (keyRef && keyRef !== urlRef) out.push({ variable, keyRef, urlRef });
  }
  return out;
}
