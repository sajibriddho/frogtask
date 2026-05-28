/**
 * POST /api/email/test
 *
 * Admin-only endpoint that (1) verifies the SMTP connection via
 * `transporter.verify()` and (2) optionally sends a short test message
 * so the user can confirm their Email settings end-to-end.
 *
 * Body: { to?: string }
 *   - If `to` is provided and is a valid email, a verification message
 *     is dispatched to that address using a branded template.
 *   - If `to` is omitted, only the connection is verified (no send).
 *
 * The `last_verified_at` / `last_verified_status` settings are updated
 * so the UI can show "last verified".
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import {
  EmailError,
  getEmailConfig,
  isValidEmail,
  recordSmtpVerification,
  sendEmail,
  verifySmtpConnection,
} from "@/lib/email";
import { getEmailBranding } from "@/lib/email-branding";
import { renderEmailShell } from "@/lib/email-templates";
import { esc } from "@/lib/email-branding";

interface Body {
  to?: string;
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission("settings.email_test");
  if (error) return error;

  let body: Body;
  try {
    body = (await req.json().catch(() => ({}))) as Body;
  } catch {
    body = {};
  }

  const to = String(body.to ?? "").trim();

  try {
    const cfg = await getEmailConfig();

    if (!cfg.enabled) {
      await recordSmtpVerification(false, "disabled");
      return NextResponse.json(
        {
          success: false,
          error:
            "Email notifications are disabled. Enable them in Settings → Email first.",
        },
        { status: 400 },
      );
    }

    // Verify the SMTP handshake regardless of whether we're sending.
    await verifySmtpConnection(cfg);

    if (!to) {
      await recordSmtpVerification(true, "connection verified");
      return NextResponse.json({
        success: true,
        data: { verifiedOnly: true },
      });
    }

    if (!isValidEmail(to)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid recipient email address." },
        { status: 400 },
      );
    }

    const branding = await getEmailBranding();
    const bodyHtml = `
      <h1 style="margin:0 0 12px 0;font-size:20px;color:#0f172a;font-weight:700;">SMTP is configured correctly</h1>
      <p style="margin:0 0 12px 0;font-size:14px;color:#374151;line-height:1.6;">
        Hi ${esc(to)}, this is a test email from <strong>${esc(branding.companyName)}</strong>.
        If you can read this, your SMTP credentials in <em>Settings → Email</em> are working
        end-to-end — the app can deliver invoices, payment receipts, password resets and
        other system notifications through your mail server.
      </p>
      <div style="margin-top:16px;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#166534;">
        Connection verified &nbsp;&bull;&nbsp; ${esc(new Date().toUTCString())}
      </div>`;

    const html = renderEmailShell({
      branding,
      title: "SMTP Test Email",
      preheader: "Your SMTP settings are working.",
      bodyHtml,
    });

    const result = await sendEmail(
      {
        to,
        subject: `${branding.companyName} — SMTP Test Email`,
        html,
      },
      cfg,
    );

    await recordSmtpVerification(true, "test email delivered");

    return NextResponse.json({
      success: true,
      data: { messageId: result.messageId, to },
    });
  } catch (err) {
    if (err instanceof EmailError) {
      await recordSmtpVerification(false, err.message.slice(0, 180));
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "Email test failed";
    console.error("POST /api/email/test", err);
    await recordSmtpVerification(false, msg.slice(0, 180));
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
