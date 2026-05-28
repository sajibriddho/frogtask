/**
 * password.ts
 *
 * Secure password hashing using Node.js built-in crypto:
 *  - PBKDF2-SHA512, 100 000 iterations, 64-byte output, random 16-byte salt.
 *  - Timing-safe comparison (prevents timing-based side-channel attacks).
 *  - Backward-compatible: falls back to SHA-256 check for passwords hashed
 *    before this module was introduced (legacy migration path).
 *
 * No external dependencies – only Node.js core `crypto` module.
 */

import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

/** Hash a plain-text password.  Returns a `salt:hash` string. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString(
    "hex",
  );
  return `${salt}:${hash}`;
}

/**
 * Verify a plain-text password against a stored hash.
 *
 * Accepts both the new PBKDF2 format (`salt:hash`) and the legacy
 * SHA-256 format (a plain 64-char hex string) so existing accounts
 * remain usable until they re-set their password or are re-seeded.
 */
export function verifyPassword(password: string, storedValue: string): boolean {
  const parts = storedValue.split(":");

  if (parts.length === 2) {
    // New PBKDF2 format
    const [salt, hash] = parts;
    const newHash = pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString(
      "hex",
    );
    try {
      return timingSafeEqual(
        Buffer.from(hash, "hex"),
        Buffer.from(newHash, "hex"),
      );
    } catch {
      return false;
    }
  }

  // Legacy SHA-256 fallback
  const legacyHash = createHash("sha256").update(password).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(legacyHash), Buffer.from(storedValue));
  } catch {
    return false;
  }
}
