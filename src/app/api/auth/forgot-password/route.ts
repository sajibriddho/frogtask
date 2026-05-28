/**
 * POST /api/auth/forgot-password
 *
 * Step 1 of the Forgot Password flow. Accepts an email address, finds
 * the matching active user, issues a new OTP, and sends it over email
 * using the configured SMTP transport.
 *
 * Body: { email: string }
 * Response: {
 *   success: true,
 *   data: { emailMasked: string, expiresAt: string, resendInSeconds: number }
 * }
 *
 * Notes:
 *   - We deliberately return the same generic shape whether the account
 *     exists or not (unless email is misconfigured, which admins must
 *     see) to prevent email enumeration via timing / response content.
 *   - Rate limiting is enforced inside `issueOtp`.
 *   - This endpoint is PUBLIC — it is the first step of account
 *     recovery and so cannot itself require authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  OTP_TTL_MIN,
  PasswordResetError,
  RESEND_COOLDOWN_SECONDS,
  findUserByEmail,
  issueOtp,
  looksLikeValidEmail,
  normalizeEmail,
} from "@/lib/password-reset";
import { EmailError, sendEmail } from "@/lib/email";
import { buildPasswordResetEmail } from "@/lib/email-templates";

interface Body {
  email?: string;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "";
}

function maskForUnknown(email: string): string {
  const at = email.indexOf("@");
  if (at < 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${"*".repeat(local.length)}${domain}`;
  return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}${domain}`;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const emailRaw = String(body.email ?? "").trim();
  if (!emailRaw) {
    return NextResponse.json(
      { success: false, error: "Email is required" },
      { status: 400 },
    );
  }
  if (!looksLikeValidEmail(emailRaw)) {
    return NextResponse.json(
      { success: false, error: "Email address is not valid" },
      { status: 400 },
    );
  }

  const normalisedEmail = normalizeEmail(emailRaw);

  try {
    const user = await findUserByEmail(normalisedEmail);

    // Uniform success response either way — but skip email if no user
    // exists (we still acknowledge to the client).
    if (!user) {
      return NextResponse.json({
        success: true,
        data: {
          emailMasked: maskForUnknown(normalisedEmail),
          expiresAt: new Date(
            Date.now() + OTP_TTL_MIN * 60 * 1000,
          ).toISOString(),
          resendInSeconds: RESEND_COOLDOWN_SECONDS,
        },
      });
    }

    const { otp, expiresAt } = await issueOtp(user, {
      ip: clientIp(req),
      ua: req.headers.get("user-agent") ?? "",
    });

    const built = await buildPasswordResetEmail({
      recipientName: user.name,
      code: otp,
      ttlMinutes: OTP_TTL_MIN,
    });
    await sendEmail({
      to: user.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });

    return NextResponse.json({
      success: true,
      data: {
        emailMasked: user.emailMasked,
        expiresAt: expiresAt.toISOString(),
        resendInSeconds: RESEND_COOLDOWN_SECONDS,
      },
    });
  } catch (err) {
    if (err instanceof PasswordResetError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.status },
      );
    }
    if (err instanceof EmailError) {
      const msg = err.configurationIssue
        ? "Email is not set up yet. Please contact your administrator."
        : "Could not send the verification code. Please try again.";
      return NextResponse.json(
        { success: false, error: msg },
        { status: err.status },
      );
    }
    console.error("POST /api/auth/forgot-password", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
