/**
 * AES-256-GCM encryption for sensitive settings values (SMTP password, …).
 *
 * A 32-byte key is derived from `SETTINGS_ENCRYPTION_KEY` (base64, hex, or
 * raw 32-char string). If the env var is missing we fall back to a
 * `NEXTAUTH_SECRET`-derived key so dev installations don't crash — for
 * production you MUST set `SETTINGS_ENCRYPTION_KEY` to a stable random
 * 32-byte value (base64-encoded, e.g. `openssl rand -base64 32`).
 *
 * Ciphertext format (single string):
 *   enc:v1:<iv base64>:<authTag base64>:<ciphertext base64>
 */

import crypto from "node:crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw =
    process.env.SETTINGS_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "frogtask-dev-fallback-please-change-me-in-prod-32b";

  // Normalise to exactly 32 bytes via SHA-256 so any-length input works.
  return crypto.createHash("sha256").update(raw).digest();
}

/** Encrypt a plaintext string; returns a self-describing token. */
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Decrypt a token produced by `encryptSecret`. Returns "" on failure. */
export function decryptSecret(token: string): string {
  if (!token || typeof token !== "string") return "";
  if (!token.startsWith(PREFIX)) return token; // plaintext legacy value
  try {
    const [, , ivB64, tagB64, dataB64] = token.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return "";
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

/** Does this value look like an encrypted token? */
export function isEncrypted(token: unknown): token is string {
  return typeof token === "string" && token.startsWith(PREFIX);
}
