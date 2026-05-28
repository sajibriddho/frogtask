/**
 * GET /api/uploads/branding/[filename]
 *
 * Legacy compatibility shim. All uploads now live under /public/uploads
 * and are served directly by Next.js at /uploads/<filename>. Older
 * records in the database may still reference this path; we permanently
 * redirect them to the canonical URL so nothing breaks.
 */

import { NextResponse } from "next/server";
import path from "node:path";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;

  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    path.isAbsolute(filename)
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid filename" },
      { status: 400 },
    );
  }

  return NextResponse.redirect(
    new URL(`/api/uploads/${filename}`, _req.url),
    308,
  );
}
