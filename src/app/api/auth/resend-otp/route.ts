/**
 * POST /api/auth/resend-otp
 *
 * Re-sends a freshly-generated OTP to the same email address. The server
 * throws away any earlier unconsumed code and applies the same
 * cooldown / per-hour cap as `forgot-password`.
 *
 * Body: { email: string }
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
  if (!looksLikeValidEmail(emailRaw)) {
    return NextResponse.json(
      { success: false, error: "Email address is not valid" },
      { status: 400 },
    );
  }

  try {
    const user = await findUserByEmail(normalizeEmail(emailRaw));
    if (!user) {
      // Uniform shape — do not leak whether the email exists.
      return NextResponse.json({
        success: true,
        data: {
          resendInSeconds: RESEND_COOLDOWN_SECONDS,
          expiresAt: new Date(
            Date.now() + OTP_TTL_MIN * 60 * 1000,
          ).toISOString(),
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
        resendInSeconds: RESEND_COOLDOWN_SECONDS,
        expiresAt: expiresAt.toISOString(),
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
    console.error("POST /api/auth/resend-otp", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
