/**
 * System Reset API — wipes the database and re-seeds it from scratch.
 *
 * POST /api/system/reset
 *   Body: { password: string, companyName: string }
 *
 * Flow (any step fails → the whole request fails, nothing destructive runs):
 *   1. Auth + require caller's `can_delete === false` (protected system user).
 *   2. Verify the submitted password against the caller's stored hash.
 *   3. Verify the submitted company name matches the "general/company_name"
 *      setting exactly (case-insensitive, trimmed) — a human gate against
 *      accidental clicks.
 *   4. Drop the database.
 *   5. Spawn `npm run seed` as a child process and wait for it to exit 0.
 *   6. Respond 200. The client is expected to immediately call `signOut()`
 *      because its session points at a user that no longer exists.
 *
 * The backup is handled separately: before calling this endpoint the client
 * downloads the full DB snapshot via `GET /api/settings/backup` so the
 * admin ends up with a file on their machine. This endpoint itself is
 * purely destructive and does not write any backup to the server.
 *
 * This is intentionally destructive. After a successful reset the caller
 * must log in again with the seeded default credentials.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { spawn } from "child_process";
import { connectDB } from "@/lib/mongodb";
import AppUser from "@/model/User";
import Setting from "@/model/Setting";
import { verifyPassword } from "@/lib/password";
import { requireAuth } from "@/lib/require-permission";

export const runtime = "nodejs";
// Reset + reseed can take tens of seconds. Don't let the platform cut us off.
export const maxDuration = 300;

interface Body {
  password?: string;
  companyName?: string;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function runSeed(): Promise<void> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const cmd = isWindows ? "npm.cmd" : "npm";
    const child = spawn(cmd, ["run", "seed"], {
      cwd: process.cwd(),
      env: process.env,
      // Inherit so logs surface in the Next.js server console — useful when
      // diagnosing a failed reset on a real deployment.
      stdio: "inherit",
      // shell:true lets Windows resolve npm via PATHEXT when npm.cmd is not
      // directly executable in the platform's runtime.
      shell: isWindows,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`seed exited with code ${code}`)),
    );
  });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const password = typeof body.password === "string" ? body.password : "";
  const companyName =
    typeof body.companyName === "string" ? body.companyName : "";

  if (!password || !companyName) {
    return NextResponse.json(
      { success: false, error: "Password and company name are required" },
      { status: 400 },
    );
  }

  try {
    await connectDB();

    // 1. Caller must be a protected (non-deletable) system user.
    const user = await AppUser.findById(session.user.id)
      .select("password can_delete status")
      .lean<{
        password: string;
        can_delete?: boolean;
        status?: string;
      } | null>();

    if (!user || user.status !== "Active") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (user.can_delete !== false) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the protected system admin may reset the system",
        },
        { status: 403 },
      );
    }

    // 2. Verify password.
    if (!verifyPassword(password, user.password)) {
      return NextResponse.json(
        { success: false, error: "Incorrect password" },
        { status: 401 },
      );
    }

    // 3. Verify the submitted company name matches the stored one.
    const setting = await Setting.findOne({
      scope: "general",
      key: "company_name",
    })
      .select("value")
      .lean<{ value?: unknown } | null>();

    const stored =
      typeof setting?.value === "string" ? setting.value.trim() : "";
    if (!stored) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Company name is not configured. Set it under General settings before resetting.",
        },
        { status: 409 },
      );
    }

    if (norm(stored) !== norm(companyName)) {
      return NextResponse.json(
        { success: false, error: "Company name does not match" },
        { status: 400 },
      );
    }

    // 4. Drop the whole database. The client is expected to have already
    //    downloaded a backup via /api/settings/backup before calling us.
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is not ready");
    const dbName = db.databaseName;
    await db.dropDatabase();

    // 5. Re-seed. The seed script opens its own mongoose connection, so it
    //    doesn't collide with the app's cached one.
    await runSeed();

    return NextResponse.json({
      success: true,
      data: { database: dbName },
    });
  } catch (err) {
    console.error("POST /api/system/reset", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "System reset failed",
      },
      { status: 500 },
    );
  }
}
