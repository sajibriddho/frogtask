/**
 * PasswordResetOtp – short-lived, single-use email OTPs for the Forgot
 * Password flow.
 *
 * Collection: passwordresetotps
 *
 * Flow:
 *  1. User enters email → we create a record with a hashed 6-digit code,
 *     an expiry timestamp, and attempts = 0.
 *  2. User submits code → we look up the most recent *unconsumed* record
 *     for that email, compare hashes timing-safely, and either mark it
 *     `verified = true` (issuing a short-lived reset token) or increment
 *     `attempts`.
 *  3. User posts new password with the reset token → we find the
 *     matching verified record, update the password, and mark
 *     `consumed = true` so it can never be reused.
 *
 * Old/expired rows are deleted automatically by a TTL index on
 * `expiresAt`.
 */

import mongoose, { Document, Schema } from "mongoose";

export interface IPasswordResetOtp extends Document {
  userId: string;
  email: string;
  /** SHA-256 of the plaintext OTP — we never store the raw code. */
  codeHash: string;
  /** Random opaque token returned once OTP is verified; presented on reset. */
  resetToken: string | null;
  resetTokenHash: string | null;
  /** Attempts made to verify; after MAX_ATTEMPTS the OTP is invalidated. */
  attempts: number;
  /** True once the user proves they know the code. */
  verified: boolean;
  /** True once the password has been reset using this OTP. */
  consumed: boolean;
  /** When the OTP (and its reset token) stop being valid. */
  expiresAt: Date;
  /** IP / UA of the requesting client for audit. */
  requesterIp: string;
  requesterUa: string;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetOtpSchema = new Schema<IPasswordResetOtp>(
  {
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true, index: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    resetToken: { type: String, default: null },
    resetTokenHash: { type: String, default: null, index: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    consumed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
    requesterIp: { type: String, default: "" },
    requesterUa: { type: String, default: "" },
  },
  {
    collection: "passwordresetotps",
    timestamps: true,
  },
);

// Mongo's TTL monitor removes documents once their expiresAt passes.
passwordResetOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetOtp =
  (mongoose.models.PasswordResetOtp as mongoose.Model<IPasswordResetOtp>) ||
  mongoose.model<IPasswordResetOtp>(
    "PasswordResetOtp",
    passwordResetOtpSchema,
  );

export default PasswordResetOtp;
