/**
 * Upload API - saves files under public/uploads.
 * API: POST /api/uploads
 */

import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { requireAuth } from "@/lib/require-permission";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function getSafeExtension(fileName: string): string {
  const ext = path.extname(fileName || "").toLowerCase();
  if (!ext || ext.length > 10) return "";
  return ext.replace(/[^.a-z0-9]/g, "");
}

function isAllowedFile(kind: string, mimeType: string, ext: string): boolean {
  if (kind === "image") {
    return (
      mimeType.startsWith("image/") &&
      [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
    );
  }

  if (kind === "cv") {
    // CV/Resume accepts all file types.
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const formData = await req.formData();
    const kind = String(formData.get("kind") || "");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    const ext = getSafeExtension(file.name);
    if (!isAllowedFile(kind, file.type, ext)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type" },
        { status: 400 },
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const outputPath = path.join(UPLOAD_DIR, filename);

    await writeFile(outputPath, buffer);

    // Served via GET /api/uploads/[filename] because Next.js doesn't
    // rescan public/ after `next build`; files written at runtime won't
    // be served by the static handler in production.
    const publicUrl = `/api/uploads/${filename}`;
    return NextResponse.json({ success: true, data: { url: publicUrl } });
  } catch (error) {
    console.error("POST /api/uploads", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
