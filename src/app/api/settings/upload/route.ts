/**
 * Settings upload API - handles logo and favicon uploads for the Settings
 * module. Writes to public/uploads so files are served by Next.js static
 * asset handler at /uploads/<filename>. Guarded by the `settings` permission.
 *
 * POST /api/settings/upload
 *   FormData: { kind: "logo" | "favicon", file: File }
 *   Response: { success, data: { url } }
 */

import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { requirePermission } from "@/lib/require-permission";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".svg"];
const ALLOWED_FAVICON_EXT = [".ico", ".png", ".svg"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function safeExtension(name: string): string {
  const ext = path.extname(name || "").toLowerCase();
  if (!ext || ext.length > 10) return "";
  return ext.replace(/[^.a-z0-9]/g, "");
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission("settings.upload");
  if (error) return error;

  try {
    const form = await req.formData();
    const kind = String(form.get("kind") || "");
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "File exceeds 2 MB limit" },
        { status: 400 },
      );
    }

    if (kind !== "logo" && kind !== "favicon") {
      return NextResponse.json(
        { success: false, error: "Invalid upload kind" },
        { status: 400 },
      );
    }

    const ext = safeExtension(file.name);
    const allowed = kind === "favicon" ? ALLOWED_FAVICON_EXT : ALLOWED_IMAGE_EXT;
    if (!allowed.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type for ${kind}` },
        { status: 400 },
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const outputPath = path.join(UPLOAD_DIR, filename);
    const bytes = await file.arrayBuffer();
    await writeFile(outputPath, Buffer.from(bytes));

    // Served via GET /api/uploads/[filename] - see that route for why
    // we don't link to /uploads/ directly after `next build`.
    return NextResponse.json({
      success: true,
      data: { url: `/api/uploads/${filename}` },
    });
  } catch (err) {
    console.error("POST /api/settings/upload", err);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 },
    );
  }
}
