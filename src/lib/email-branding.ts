/**
 * email-branding.ts — server-side helper that reads company branding from
 * the Settings scope. Used by the email template system because email
 * rendering happens on the server (the client hooks in `useBranding` are
 * not available there).
 */

import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Setting from "@/model/Setting";
import { defaultsFor } from "@/lib/settings-catalogue";

void mongoose.models;

export interface EmailBranding {
  companyName: string;
  companyLogo: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

interface RawRow {
  scope: string;
  key: string;
  value: unknown;
}

const SCOPES_NEEDED = ["general", "contact"] as const;

export async function getEmailBranding(): Promise<EmailBranding> {
  await connectDB();
  const rows = await Setting.find({
    scope: { $in: SCOPES_NEEDED as unknown as string[] },
  })
    .select("scope key value")
    .lean<RawRow[]>();

  const merged: Record<string, Record<string, unknown>> = {};
  for (const s of SCOPES_NEEDED) merged[s] = { ...defaultsFor(s) };
  for (const r of rows) {
    if (!merged[r.scope]) merged[r.scope] = {};
    merged[r.scope][r.key] = r.value;
  }

  const get = (scope: string, key: string, fallback = ""): string => {
    const v = merged[scope]?.[key];
    return v === undefined || v === null ? fallback : String(v);
  };

  return {
    companyName: get("general", "company_name", "Frogtask"),
    companyLogo: get("general", "company_logo", ""),
    address: get("contact", "address", ""),
    phone: get("contact", "phone", ""),
    email: get("contact", "email", ""),
    website: get("contact", "website", ""),
  };
}

/** Minimal HTML-escape helper so user-supplied strings can't break markup. */
export function esc(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
