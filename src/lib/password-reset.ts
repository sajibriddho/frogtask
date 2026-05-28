/**
 * password-reset.ts — server-side logic for the Forgot Password flow.
 *
 * Centralises OTP generation / verification and user lookup by email,
 * so the route handlers stay thin. Security rules live here:
 *   - OTPs are 6-digit, stored as SHA-256 hashes.
 *   - OTPs expire after OTP_TTL_MIN minutes.
 *   - Max MAX_VERIFY_ATTEMPTS code attempts before invalidation.
 *   - New OTP request invalidates the previous one (per email).
 *   - Resends are rate-limited by RESEND_COOLDOWN_SECONDS.
 *   - Max MAX_REQUESTS_PER_HOUR distinct OTP requests per email per hour.
 *   - A short-lived resetToken is issued only after OTP verification and
 *     must be presented (timing-safe) to finalize the password change.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import AppUser from "@/model/User";
import PasswordResetOtp from "@/model/PasswordResetOtp";

void mongoose.models;

/** 6-digit numeric code, zero-padded. */
const OTP_LENGTH = 6;
export const OTP_TTL_MIN = 10;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_VERIFY_ATTEMPTS = 5;
export const MAX_REQUESTS_PER_HOUR = 6;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Cryptographically-random 6-digit code. */
export function generateOtp(): string {
  // Use 4 random bytes → uint32 → modulo 10^OTP_LENGTH. Bias is
  // negligible for OTP_LENGTH = 6 and keeps the code simple.
  const n = randomBytes(4).readUInt32BE(0) % 10 ** OTP_LENGTH;
  return String(n).padStart(OTP_LENGTH, "0");
}

export interface ResolvedUser {
  id: string;
  name: string;
  email: string;
  /** Masked email for display ("j***@example.com"). */
  emailMasked: string;
}

/** Lightweight RFC-5322-ish check; Nodemailer will reject anything worse. */
export function looksLikeValidEmail(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Canonical form used for DB lookups and storage. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) {
    return `${"*".repeat(local.length)}${domain}`;
  }
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}${domain}`;
}

/**
 * Find an Active user account owning this email address. Users have
 * `email` stored directly on `AppUser`, so no Staff indirection is
 * needed.
 *
 * Returns `null` if nothing matches — callers should treat this as
 * "user not found" (but may choose to return the same generic response
 * either way to prevent email enumeration).
 */
export async function findUserByEmail(
  email: string,
): Promise<ResolvedUser | null> {
  await connectDB();
  const target = normalizeEmail(email);
  if (!target) return null;

  const user = await AppUser.findOne({
    email: target,
    status: "Active",
  })
    .select("_id name email status")
    .lean<{
      _id: unknown;
      name: string;
      email: string;
      status: string;
    } | null>();

  if (!user) return null;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    emailMasked: maskEmail(user.email),
  };
}

/**
 * Idempotent "start forgot password" step. Creates a new OTP record,
 * invalidates any earlier unconsumed ones for the same email, and
 * returns the plaintext OTP so the caller can send it via email.
 *
 * Throws `PasswordResetError` when the user requests too fast or too often.
 */
export class PasswordResetError extends Error {
  status: number;
  code: string;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "PasswordResetError";
    this.code = code;
    this.status = status;
  }
}

export interface IssueOtpResult {
  otp: string;
  expiresAt: Date;
  email: string;
}

export async function issueOtp(
  user: ResolvedUser,
  opts: { ip?: string; ua?: string } = {},
): Promise<IssueOtpResult> {
  await connectDB();

  const now = new Date();

  // Rate-limit: OTPs generated in the last hour.
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentCount = await PasswordResetOtp.countDocuments({
    email: user.email,
    createdAt: { $gte: hourAgo },
  });
  if (recentCount >= MAX_REQUESTS_PER_HOUR) {
    throw new PasswordResetError(
      "Too many reset requests. Please try again in a bit.",
      "rate_limited",
      429,
    );
  }

  // Cooldown: previous unconsumed record created very recently?
  const last = await PasswordResetOtp.findOne({
    email: user.email,
    consumed: false,
  })
    .sort({ createdAt: -1 })
    .lean<{ createdAt: Date } | null>();
  if (last) {
    const elapsed = (now.getTime() - last.createdAt.getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
      throw new PasswordResetError(
        `Please wait ${wait}s before requesting another code.`,
        "cooldown",
        429,
      );
    }
  }

  // Invalidate every earlier unconsumed code for this email.
  await PasswordResetOtp.updateMany(
    { email: user.email, consumed: false },
    { $set: { consumed: true, verified: false, resetToken: null } },
  );

  const otp = generateOtp();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MIN * 60 * 1000);

  await PasswordResetOtp.create({
    userId: user.id,
    email: user.email,
    codeHash: sha256(otp),
    expiresAt,
    requesterIp: opts.ip ?? "",
    requesterUa: (opts.ua ?? "").slice(0, 240),
  });

  return { otp, expiresAt, email: user.email };
}

export interface VerifyOtpResult {
  resetToken: string;
  userId: string;
  email: string;
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<VerifyOtpResult> {
  await connectDB();
  const normEmail = normalizeEmail(email);
  if (!normEmail || !looksLikeValidEmail(normEmail)) {
    throw new PasswordResetError("Email is required", "bad_request", 400);
  }
  if (!/^\d{4,8}$/.test(code.trim())) {
    throw new PasswordResetError("Invalid code format", "bad_code", 400);
  }

  const record = await PasswordResetOtp.findOne({
    email: normEmail,
    consumed: false,
  }).sort({ createdAt: -1 });

  if (!record) {
    throw new PasswordResetError(
      "No active code. Please request a new one.",
      "not_found",
      404,
    );
  }

  if (record.expiresAt.getTime() < Date.now()) {
    record.consumed = true;
    await record.save();
    throw new PasswordResetError(
      "This code has expired. Please request a new one.",
      "expired",
      400,
    );
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    record.consumed = true;
    await record.save();
    throw new PasswordResetError(
      "Too many incorrect attempts. Please request a new code.",
      "attempts_exceeded",
      429,
    );
  }

  const candidateHash = sha256(code.trim());
  let match = false;
  try {
    match = timingSafeEqual(
      Buffer.from(candidateHash, "hex"),
      Buffer.from(record.codeHash, "hex"),
    );
  } catch {
    match = false;
  }

  if (!match) {
    record.attempts += 1;
    await record.save();
    const remaining = MAX_VERIFY_ATTEMPTS - record.attempts;
    if (remaining <= 0) {
      record.consumed = true;
      await record.save();
      throw new PasswordResetError(
        "Too many incorrect attempts. Please request a new code.",
        "attempts_exceeded",
        429,
      );
    }
    throw new PasswordResetError(
      `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`,
      "invalid_code",
      400,
    );
  }

  // Issue a short-lived opaque reset token; only its hash goes to DB.
  const rawToken = randomBytes(32).toString("hex");
  record.verified = true;
  record.resetToken = null;
  record.resetTokenHash = sha256(rawToken);
  await record.save();

  return {
    resetToken: rawToken,
    userId: record.userId,
    email: record.email,
  };
}

/**
 * Consumes the verified OTP + its reset token and writes the new
 * password hash to the user. On any failure the OTP stays consumable,
 * so make sure hash/save steps run inside a try/catch at the call site.
 */
export async function consumeReset(
  email: string,
  resetToken: string,
): Promise<{ userId: string; record: mongoose.Document }> {
  await connectDB();
  const normEmail = normalizeEmail(email);
  if (!normEmail || !resetToken) {
    throw new PasswordResetError("Missing email or reset token", "bad_request", 400);
  }

  const tokenHash = sha256(resetToken);
  const record = await PasswordResetOtp.findOne({
    email: normEmail,
    verified: true,
    consumed: false,
    resetTokenHash: tokenHash,
  });

  if (!record) {
    throw new PasswordResetError(
      "Invalid or expired reset session. Please restart the process.",
      "invalid_token",
      400,
    );
  }
  if (record.expiresAt.getTime() < Date.now()) {
    record.consumed = true;
    await record.save();
    throw new PasswordResetError(
      "Reset session has expired. Please restart the process.",
      "expired",
      400,
    );
  }

  return { userId: record.userId, record };
}
