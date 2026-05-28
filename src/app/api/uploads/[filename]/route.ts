/**
 * GET /api/uploads/[filename]
 *
 * Streams a file from public/uploads at runtime. Exists because Next.js
 * caches the public/ directory manifest at build time — files written
 * by POST /api/uploads after `next build` won't be served by the static
 * handler in production. Reading from disk in an API route works
 * identically in dev, `next start`, and any Node host with a writable
 * filesystem.
 */

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const CONTENT_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

function contentTypeFor(ext: string): string {
  return CONTENT_TYPE[ext.toLowerCase()] ?? "application/octet-stream";
}

function resolveSafe(baseDir: string, filename: string): string | null {
  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    path.isAbsolute(filename)
  ) {
    return null;
  }
  const resolved = path.resolve(baseDir, filename);
  const base = path.resolve(baseDir);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    return null;
  }
  return resolved;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  const abs = resolveSafe(UPLOAD_DIR, filename);
  if (!abs) {
    return NextResponse.json(
      { success: false, error: "Invalid filename" },
      { status: 400 },
    );
  }

  try {
    const bytes = await readFile(abs);
    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(path.extname(filename)),
        "Content-Length": String(bytes.byteLength),
        // Filenames are UUID-unique, so aggressive caching is safe.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Asset not found" },
      { status: 404 },
    );
  }
}
