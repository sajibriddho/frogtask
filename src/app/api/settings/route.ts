/**
 * Settings API.
 *
 * GET  /api/settings              → returns all settings grouped by scope,
 *                                   with secrets masked.
 * GET  /api/settings?scope=<name> → settings for a single scope.
 * PUT  /api/settings               → upsert a single scope's settings.
 *                                    Body: { scope: string, values: Record<string, any> }
 *                                    Secret fields left as MASKED_PLACEHOLDER
 *                                    (or missing) are preserved as-is.
 *
 * Only `settings` permission-holders can read or write.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Setting from "@/model/Setting";
import { requirePermission } from "@/lib/require-permission";
import {
  MASKED_PLACEHOLDER,
  SETTINGS_CATALOGUE,
  defaultsFor,
  isKnownScope,
  isSecretField,
} from "@/lib/settings-catalogue";
import { encryptSecret } from "@/lib/settings-crypto";

void mongoose.models;

interface SettingRow {
  scope: string;
  key: string;
  value: unknown;
  isSecret?: boolean;
  updatedAt?: Date;
}

/** Mask a secret value for client delivery. Returns null if empty. */
function maskForClient(value: unknown): {
  value: string;
  hasValue: boolean;
} {
  const has = value !== null && value !== undefined && value !== "";
  return { value: has ? MASKED_PLACEHOLDER : "", hasValue: has };
}

/**
 * Merge DB rows onto the catalogue defaults so the UI always receives a
 * complete shape, even the first time a setting is ever touched.
 */
function buildScopePayload(
  scope: string,
  rows: SettingRow[],
): {
  scope: string;
  values: Record<string, unknown>;
  secretStatus: Record<string, boolean>;
  updatedAt: string | null;
} {
  const values: Record<string, unknown> = defaultsFor(scope);
  const secretStatus: Record<string, boolean> = {};
  let latest: Date | null = null;

  for (const r of rows) {
    if (r.scope !== scope) continue;
    if (isSecretField(scope, r.key)) {
      const { value, hasValue } = maskForClient(r.value);
      values[r.key] = value;
      secretStatus[r.key] = hasValue;
    } else {
      values[r.key] = r.value;
    }
    if (r.updatedAt && (!latest || r.updatedAt > latest)) latest = r.updatedAt;
  }

  // Any secret key we never saw in the DB still needs a status entry.
  for (const f of SETTINGS_CATALOGUE[scope] ?? []) {
    if (f.isSecret && secretStatus[f.key] === undefined) {
      secretStatus[f.key] = false;
    }
  }

  return {
    scope,
    values,
    secretStatus,
    updatedAt: latest ? latest.toISOString() : null,
  };
}

export async function GET(req: NextRequest) {
  const { error } = await requirePermission("settings");
  if (error) return error;

  try {
    await connectDB();
    const scope = req.nextUrl.searchParams.get("scope") ?? "";

    if (scope) {
      if (!isKnownScope(scope)) {
        return NextResponse.json(
          { success: false, error: "Unknown scope" },
          { status: 400 },
        );
      }
      const rows = await Setting.find({ scope }).lean<SettingRow[]>();
      return NextResponse.json({
        success: true,
        data: buildScopePayload(scope, rows),
      });
    }

    // All scopes
    const rows = await Setting.find().lean<SettingRow[]>();
    const data = Object.keys(SETTINGS_CATALOGUE).map((s) =>
      buildScopePayload(s, rows),
    );
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/settings", err);
    return NextResponse.json(
      { success: false, error: "Failed to load settings" },
      { status: 500 },
    );
  }
}

interface PutBody {
  scope?: string;
  values?: Record<string, unknown>;
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requirePermission("settings.update");
  if (error) return error;

  try {
    await connectDB();
    const body = (await req.json()) as PutBody;
    const { scope, values } = body;

    if (!scope || !isKnownScope(scope)) {
      return NextResponse.json(
        { success: false, error: "Unknown or missing scope" },
        { status: 400 },
      );
    }
    if (!values || typeof values !== "object") {
      return NextResponse.json(
        { success: false, error: "Missing values" },
        { status: 400 },
      );
    }

    const catalogueKeys = new Set(
      (SETTINGS_CATALOGUE[scope] ?? []).map((f) => f.key),
    );

    const updatedBy = {
      id: String(session.user.id),
      name: String(session.user.name ?? session.user.email ?? "unknown"),
    };

    const writes: Promise<unknown>[] = [];

    for (const [key, rawValue] of Object.entries(values)) {
      if (!catalogueKeys.has(key)) continue; // ignore unknown keys

      const isSecret = isSecretField(scope, key);

      // Secret left masked or missing → don't touch the existing encrypted
      // value. This lets the UI safely submit the whole form without
      // round-tripping the plaintext.
      if (isSecret && (rawValue === MASKED_PLACEHOLDER || rawValue === undefined)) {
        continue;
      }

      // Clearing a secret (empty string) → store explicit empty.
      let valueToStore: unknown = rawValue;
      if (isSecret && typeof rawValue === "string" && rawValue !== "") {
        valueToStore = encryptSecret(rawValue);
      }

      writes.push(
        Setting.findOneAndUpdate(
          { scope, key },
          {
            $set: {
              value: valueToStore,
              isSecret,
              updatedBy,
            },
          },
          { upsert: true, returnDocument: "after" },
        ).exec(),
      );
    }

    await Promise.all(writes);

    const rows = await Setting.find({ scope }).lean<SettingRow[]>();
    return NextResponse.json({
      success: true,
      data: buildScopePayload(scope, rows),
    });
  } catch (err) {
    console.error("PUT /api/settings", err);
    return NextResponse.json(
      { success: false, error: "Failed to save settings" },
      { status: 500 },
    );
  }
}
