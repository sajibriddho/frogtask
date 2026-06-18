/**
 * proxy.ts — Next.js 16 edge middleware (formerly middleware.ts).
 *
 * Auth + permission gate. Reads the NextAuth JWT and matches the route
 * against `ROUTE_PERMISSIONS`; missing permission → /access-denied,
 * missing/invalid token → /login.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** URL-prefix → required permission id. */
const ROUTE_PERMISSIONS: [prefix: string, permissionId: string][] = [
  ["/roles", "roles"],
  ["/users", "users"],
  ["/dashboard", "dashboard"],
  ["/settings", "settings"],
];

function hasPermission(permissionIds: string[], required: string): boolean {
  return permissionIds.some(
    (id) => id === required || id.startsWith(required + "."),
  );
}

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token || token.valid === false) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname && pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname + search);
    }
    return NextResponse.redirect(loginUrl);
  }

  const match = ROUTE_PERMISSIONS.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
  if (match) {
    const permissionIds =
      (token.permission_ids as string[] | undefined) ?? [];
    if (!hasPermission(permissionIds, match[1])) {
      return NextResponse.redirect(new URL("/access-denied", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // The trailing `.+` (instead of `.*`) requires at least one character
  // after the leading slash — so the bare `/` (the public landing page)
  // never invokes the middleware at all. login / register / etc. are
  // skipped via the negative lookahead as before.
  matcher: [
    "/((?!api/auth|api/settings/public|_next/static|_next/image|favicon\\.ico|login|register|forgot-password|access-denied).*)",
  ],
};
