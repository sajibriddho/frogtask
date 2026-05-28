/**
 * email.ts — reusable SMTP email sender.
 *
 * Reads SMTP settings from the `email` settings scope (decrypting the
 * password) and exposes `sendEmail(...)` plus `verifySmtpConnection()`.
 *
 * Any feature that needs email (password reset, account verification,
 * notifications) should go through this module so SMTP credentials are
 * never hardcoded at the call site.
 *
 *   import { sendEmail } from "@/lib/email";
 *   await sendEmail({ to, subject, html, text });
 *
 * Never import from client code — it reads the DB and decrypts secrets.
 */

import mongoose from "mongoose";
import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { connectDB } from "@/lib/mongodb";
import Setting from "@/model/Setting";
import { defaultsFor } from "@/lib/settings-catalogue";
import { decryptSecret } from "@/lib/settings-crypto";

void mongoose.models;

// ── Types ──────────────────────────────────────────────────────────────

export type EmailEncryption = "ssl" | "tls" | "none";

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  encryption: EmailEncryption;
  authRequired: boolean;
  timeoutSeconds: number;
  /** True when all mandatory fields are present AND enabled is true. */
  configured: boolean;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
}

interface RawRow {
  scope: string;
  key: string;
  value: unknown;
}

// ── Error type ─────────────────────────────────────────────────────────

export class EmailError extends Error {
  status: number;
  configurationIssue: boolean;

  constructor(
    message: string,
    opts: { status?: number; configurationIssue?: boolean } = {},
  ) {
    super(message);
    this.name = "EmailError";
    this.status = opts.status ?? 500;
    this.configurationIssue = !!opts.configurationIssue;
  }
}

// ── Config loader ──────────────────────────────────────────────────────

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return fallback;
}

/** Loads SMTP settings with the password decrypted. */
export async function getEmailConfig(): Promise<EmailConfig> {
  await connectDB();
  const rows = await Setting.find({ scope: "email" })
    .select("scope key value")
    .lean<RawRow[]>();

  const merged: Record<string, unknown> = { ...defaultsFor("email") };
  for (const r of rows) {
    if (r.key === "smtp_password") {
      merged[r.key] = decryptSecret(
        typeof r.value === "string" ? r.value : "",
      );
    } else {
      merged[r.key] = r.value;
    }
  }

  const host = String(merged.smtp_host ?? "").trim();
  const port = Number(merged.smtp_port) || 0;
  const username = String(merged.smtp_username ?? "").trim();
  const password = String(merged.smtp_password ?? "");
  const fromEmail = String(merged.from_email ?? "").trim();
  const fromName = String(merged.from_name ?? "").trim();
  const replyTo = String(merged.reply_to ?? "").trim();
  const encryption = (String(merged.encryption ?? "tls") as EmailEncryption);
  const authRequired = bool(merged.auth_required, true);
  const timeoutSeconds = Number(merged.timeout_seconds) || 20;
  const enabled = bool(merged.enabled, false);

  const mandatoryOk =
    host.length > 0 &&
    port > 0 &&
    fromEmail.length > 0 &&
    (!authRequired || (username.length > 0 && password.length > 0));

  return {
    enabled,
    host,
    port,
    username,
    password,
    fromEmail,
    fromName,
    replyTo,
    encryption,
    authRequired,
    timeoutSeconds,
    configured: enabled && mandatoryOk,
  };
}

// ── Validation ─────────────────────────────────────────────────────────

export function isValidEmail(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  // Lightweight RFC-5322-ish check. Nodemailer will reject anything worse.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// ── Transporter ────────────────────────────────────────────────────────

function buildTransporter(cfg: EmailConfig): Transporter<SMTPTransport.SentMessageInfo> {
  const timeoutMs = Math.max(5_000, cfg.timeoutSeconds * 1000);

  const opts: SMTPTransport.Options = {
    host: cfg.host,
    port: cfg.port,
    // SSL = implicit TLS on port 465. STARTTLS handled by `secure: false`.
    secure: cfg.encryption === "ssl",
    requireTLS: cfg.encryption === "tls",
    ignoreTLS: cfg.encryption === "none",
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  };

  if (cfg.authRequired) {
    opts.auth = { user: cfg.username, pass: cfg.password };
  }

  return nodemailer.createTransport(opts);
}

// ── From address helper ────────────────────────────────────────────────

function formatFrom(cfg: EmailConfig): string {
  if (cfg.fromName) {
    const safeName = cfg.fromName.replace(/"/g, "'");
    return `"${safeName}" <${cfg.fromEmail}>`;
  }
  return cfg.fromEmail;
}

// ── Public API ─────────────────────────────────────────────────────────

/** Send one email. Throws `EmailError` on any failure. */
export async function sendEmail(
  options: SendEmailOptions,
  cfg?: EmailConfig,
): Promise<{ messageId: string }> {
  const config = cfg ?? (await getEmailConfig());

  if (!config.enabled) {
    throw new EmailError("Email notifications are disabled in system settings", {
      status: 503,
      configurationIssue: true,
    });
  }
  if (!config.configured) {
    throw new EmailError(
      "SMTP is not fully configured. Please fill in host, port, credentials and sender email in Settings → Email.",
      { status: 503, configurationIssue: true },
    );
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  for (const r of recipients) {
    if (!isValidEmail(r)) {
      throw new EmailError(`Recipient email is invalid: ${r}`, { status: 400 });
    }
  }

  const transporter = buildTransporter(config);

  try {
    const info = await transporter.sendMail({
      from: formatFrom(config),
      to: recipients,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo || config.replyTo || undefined,
      subject: options.subject,
      html: options.html,
      text: options.text || htmlToText(options.html),
      attachments: options.attachments,
    });
    return { messageId: String(info.messageId ?? "") };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email send failed";
    console.error("[email] send failed", { message });
    throw new EmailError(message, { status: 502 });
  } finally {
    transporter.close();
  }
}

/**
 * Verify an SMTP connection using the stored config. Throws `EmailError`
 * on failure; resolves on success. Used by the Settings test button.
 */
export async function verifySmtpConnection(cfg?: EmailConfig): Promise<void> {
  const config = cfg ?? (await getEmailConfig());
  if (!config.configured) {
    throw new EmailError(
      "SMTP is not fully configured. Please complete the settings before testing.",
      { status: 400, configurationIssue: true },
    );
  }
  const transporter = buildTransporter(config);
  try {
    await transporter.verify();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    throw new EmailError(message, { status: 502 });
  } finally {
    transporter.close();
  }
}

/** Persist a verification status so the settings UI can show "last verified". */
export async function recordSmtpVerification(ok: boolean, detail?: string): Promise<void> {
  await connectDB();
  const now = new Date().toISOString();
  const status = ok ? `Success${detail ? ` — ${detail}` : ""}` : `Failed${detail ? ` — ${detail}` : ""}`;
  await Promise.all([
    Setting.findOneAndUpdate(
      { scope: "email", key: "last_verified_at" },
      { $set: { value: now, isSecret: false } },
      { upsert: true },
    ).exec(),
    Setting.findOneAndUpdate(
      { scope: "email", key: "last_verified_status" },
      { $set: { value: status, isSecret: false } },
      { upsert: true },
    ).exec(),
  ]);
}

// ── Tiny html→text fallback so clients without HTML support still read well.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
