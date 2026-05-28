/**
 * POST /api/auth/verify-otp
 *
 * Step 2 of the Forgot Password flow. Checks the OTP the user received
 * via email. On success we return a short-lived opaque `resetToken`
 * that must be presented when finalising the password change.
 *
 * Body: { email: string, code: string }
 * Response:
 *   200 → { success: true, data: { resetToken: string, expiresAt: string } }
 *   4xx → { success: false, error, code }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  OTP_TTL_MIN,
  PasswordResetError,
  verifyOtp,
} from "@/lib/password-reset";

interface Body {
  email?: string;
  code?: string;
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

  const email = String(body.email ?? "").trim();
  const code = String(body.code ?? "").trim();

  if (!email || !code) {
    return NextResponse.json(
      { success: false, error: "Email and code are required" },
      { status: 400 },
    );
  }

  try {
    const { resetToken } = await verifyOtp(email, code);
    return NextResponse.json({
      success: true,
      data: {
        resetToken,
        expiresAt: new Date(
          Date.now() + OTP_TTL_MIN * 60 * 1000,
        ).toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof PasswordResetError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("POST /api/auth/verify-otp", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
