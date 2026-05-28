/**
 * email-templates.ts — shared email layout + the password-reset OTP email.
 *
 * Design goals
 *  • International-standard, responsive, table-based HTML that renders
 *    cleanly in Gmail, Outlook, Apple Mail and most webmail clients.
 *  • Shared master layout (`renderEmailShell`) with branded header, body
 *    slot, and footer.
 *  • All dynamic strings are HTML-escaped via `esc(...)`.
 */

import { esc, getEmailBranding, type EmailBranding } from "@/lib/email-branding";

// ── Public types ───────────────────────────────────────────────────────

export interface EmailBuildResult {
  subject: string;
  html: string;
  text: string;
}

// ── Master layout ──────────────────────────────────────────────────────

/**
 * Build the shared email shell — header (logo + company name), optional
 * preheader, body slot, and footer. The body argument should already be
 * sanitised HTML (use `esc` for any user-supplied values).
 */
export function renderEmailShell(opts: {
  branding: EmailBranding;
  title: string;
  preheader?: string;
  bodyHtml: string;
}): string {
  const { branding, title, preheader = "", bodyHtml } = opts;

  const company = esc(branding.companyName);
  const contactBits: string[] = [];
  if (branding.address) contactBits.push(esc(branding.address));
  if (branding.phone) contactBits.push(esc(branding.phone));
  if (branding.email) contactBits.push(esc(branding.email));
  if (branding.website) contactBits.push(esc(branding.website));
  const contactLine = contactBits.join(" &nbsp;&bull;&nbsp; ");

  const year = new Date().getFullYear();

  const logoBlock = branding.companyLogo
    ? `<img src="${esc(branding.companyLogo)}" alt="${company}" style="max-height:44px;display:block;border:0;outline:none;text-decoration:none;" />`
    : `<div style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">${company}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${
    preheader
      ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${esc(preheader)}</span>`
      : ""
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #e2e8f0;">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:#0f172a;font-size:14px;line-height:1.55;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.55;">
              ${contactLine ? `<div style="margin-bottom:6px;">${contactLine}</div>` : ""}
              <div>© ${year} ${company}. All rights reserved.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Password reset OTP email ───────────────────────────────────────────

export interface PasswordResetEmailInput {
  /** The account holder's display name (may be empty). */
  recipientName: string;
  /** 6-digit OTP code to include in the body. */
  code: string;
  /** Minutes until the code expires — used in the body copy. */
  ttlMinutes: number;
}

/**
 * Build a branded password-reset email with the OTP code. The returned
 * result is ready to hand to `sendEmail` as-is.
 */
export async function buildPasswordResetEmail(
  input: PasswordResetEmailInput,
): Promise<EmailBuildResult> {
  const branding = await getEmailBranding();
  const company = esc(branding.companyName);
  const name = esc((input.recipientName || "").trim()) || "there";
  const code = esc(input.code);
  const ttl = Math.max(1, Math.floor(input.ttlMinutes));

  const bodyHtml = `
<h1 style="margin:0 0 6px 0;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;letter-spacing:-0.01em;">
  Reset your password
</h1>
<p style="margin:0 0 18px 0;font-size:13px;color:#6b7280;">
  Hi ${name}, we received a request to reset the password on your
  ${company} account. Use the verification code below to continue.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px 0;">
  <tr>
    <td align="center" style="padding:18px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.14em;margin-bottom:8px;">Verification code</div>
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;color:#0f172a;letter-spacing:0.4em;">${code}</div>
      <div style="margin-top:10px;font-size:12px;color:#64748b;">Expires in ${ttl} minute${ttl === 1 ? "" : "s"}.</div>
    </td>
  </tr>
</table>

<p style="margin:0 0 12px 0;font-size:13px;color:#374151;line-height:1.55;">
  Enter this code on the password reset page to choose a new password.
  For your security, do not share this code with anyone.
</p>

<div style="margin-top:18px;padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
  <div style="font-size:11px;color:#b45309;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px;">Didn't request this?</div>
  <div style="font-size:13px;color:#7c2d12;line-height:1.55;">
    You can safely ignore this email — your password will not change
    unless someone uses this code. If you are concerned about your
    account, please contact your administrator.
  </div>
</div>
`;

  const html = renderEmailShell({
    branding,
    title: "Password Reset Code",
    preheader: `Your ${branding.companyName} password reset code is ${input.code}`,
    bodyHtml,
  });

  const text = [
    "Reset your password",
    "".padEnd(40, "-"),
    `Hi ${(input.recipientName || "").trim() || "there"},`,
    "",
    `We received a request to reset the password on your ${branding.companyName} account.`,
    "",
    `Verification code: ${input.code}`,
    `Expires in ${ttl} minute${ttl === 1 ? "" : "s"}.`,
    "",
    "Enter this code on the password reset page to continue.",
    "For your security, do not share this code with anyone.",
    "",
    "If you did not request this, you can safely ignore this email.",
    "",
    `— ${branding.companyName}`,
  ].join("\n");

  const prefix = branding.companyName ? `[${branding.companyName}] ` : "";
  return {
    subject: `${prefix}Password reset code: ${input.code}`,
    html,
    text,
  };
}
