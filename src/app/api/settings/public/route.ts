/**
 * Public settings endpoint – returns every setting the UI needs to render
 * branded pages. No secrets, no credentials.
 *
 * GET /api/settings/public
 *   Response: { success, data: {
 *     // Branding
 *     company_name, company_logo, company_favicon,
 *     // Contact (printed on invoices, receipts)
 *     phone, email, website, business_hours, address,
 *     // Locale
 *     default_country, default_language,
 *   }}
 *
 * Deliberately **public** (no auth) so the login page can show
 * the tenant's brand. Everything here is already visible on printed
 * documents or is locale metadata — nothing sensitive.
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Setting from "@/model/Setting";
import { defaultsFor } from "@/lib/settings-catalogue";

void mongoose.models;

/** Scopes + keys exposed publicly. Anything not listed stays private. */
const PUBLIC_KEYS: { scope: string; key: string }[] = [
  // Branding
  { scope: "general", key: "company_name" },
  { scope: "general", key: "company_logo" },
  { scope: "general", key: "company_favicon" },
  { scope: "general", key: "default_country" },
  { scope: "general", key: "default_language" },
  // Contact
  { scope: "contact", key: "phone" },
  { scope: "contact", key: "email" },
  { scope: "contact", key: "website" },
  { scope: "contact", key: "business_hours" },
  { scope: "contact", key: "address" },
];

export async function GET() {
  try {
    await connectDB();

    // Start every key at its catalogue default so the response shape is
    // stable even before a setting has ever been saved.
    const out: Record<string, unknown> = {
      ...defaultsFor("general"),
      ...defaultsFor("contact"),
    };

    const rows = await Setting.find({
      $or: PUBLIC_KEYS.map((p) => ({ scope: p.scope, key: p.key })),
    })
      .select("scope key value")
      .lean<{ scope: string; key: string; value: unknown }[]>();

    for (const r of rows) {
      out[r.key] = r.value;
    }

    return NextResponse.json({
      success: true,
      data: {
        // Branding
        company_name: out.company_name ?? "",
        company_logo: out.company_logo ?? "",
        company_favicon: out.company_favicon ?? "",
        default_country: out.default_country ?? "US",
        default_language: out.default_language ?? "en",
        // Contact
        phone: out.phone ?? "",
        email: out.email ?? "",
        website: out.website ?? "",
        business_hours: out.business_hours ?? "",
        address: out.address ?? "",
      },
    });
  } catch (err) {
    console.error("GET /api/settings/public", err);
    return NextResponse.json(
      { success: false, error: "Failed to load settings" },
      { status: 500 },
    );
  }
}
