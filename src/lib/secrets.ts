/**
 * Symmetric encryption for the few secrets Nest has to hand back to a person —
 * today only the shared-login passwords in the social media module.
 *
 * The database stores ciphertext, so a dump, a backup, or a leaked read does
 * not hand anyone a client's social account. Decryption happens in a server
 * action that has already checked who is asking.
 *
 * Key: SOCIAL_SECRET_KEY — 32 bytes, base64 or hex. Generate one with
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * Rotating the key makes existing ciphertext unreadable; re-enter those logins.
 *
 * Wire format: `v1.<iv>.<tag>.<ciphertext>`, each part base64url.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce
const KEY_BYTES = 32;

export class SecretKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretKeyError";
  }
}

function decodeKey(raw: string): Buffer {
  const trimmed = raw.trim();
  // Hex first — a 64-char hex string is also valid base64url, and hex is the
  // more specific reading.
  const key = /^[0-9a-fA-F]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  if (key.length !== KEY_BYTES) {
    throw new SecretKeyError(
      `SOCIAL_SECRET_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}).`,
    );
  }
  return key;
}

function readKey(): Buffer {
  const raw = process.env.SOCIAL_SECRET_KEY;
  if (!raw) {
    throw new SecretKeyError(
      "SOCIAL_SECRET_KEY is not set — shared logins cannot store or reveal a password.",
    );
  }
  return decodeKey(raw);
}

/** Is the module able to handle secrets at all? Safe to call for gating UI. */
export function secretsAvailable(): boolean {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string, keyOverride?: string): string {
  const key = keyOverride ? decodeKey(keyOverride) : readKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

/**
 * Returns null for anything that is not readable with the current key —
 * malformed, tampered with, or written under a key that has since rotated.
 * Callers show "unavailable", they never crash a page over it.
 */
export function decryptSecret(
  payload: string | null | undefined,
  keyOverride?: string,
): string | null {
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const key = keyOverride ? decodeKey(keyOverride) : readKey();
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const ct = Buffer.from(parts[3], "base64url");
    if (iv.length !== IV_BYTES || tag.length !== 16) return null;
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}
