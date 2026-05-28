/**
 * auth-options.ts
 *
 * Canonical NextAuth configuration extracted into a shared module so both
 * the NextAuth route handler and server-side helpers (getServerSession) can
 * import the same options object.
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDB } from "@/lib/mongodb";
import { verifyPassword } from "@/lib/password";
import AppUser from "@/model/User";
import RolePermission from "@/model/RolePermission";

/** How often the JWT callback re-reads the user + permissions from the DB. */
const USER_RECHECK_MS = 15 * 1_000;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await AppUser.findOne({
          email: credentials.email.toLowerCase().trim(),
        });

        // Email not found → fall through to the generic "invalid credentials"
        // message so we don't leak which emails are registered.
        if (!user) return null;

        // Email exists but the account isn't yet usable — surface a specific
        // message so the user knows whether to wait for approval, contact an
        // admin, etc. Throwing from authorize() in NextAuth v4 puts the
        // error message into `result.error` on the client (redirect:false).
        if (user.status === "Pending") {
          throw new Error("AccountPending");
        }
        if (user.status === "Inactive") {
          throw new Error("AccountInactive");
        }
        if (user.status !== "Active") {
          // Defensive fallback for any future status we don't recognise.
          throw new Error("AccountInactive");
        }

        // Active account — verify the password. Wrong password collapses
        // back into the generic invalid-credentials message.
        if (!verifyPassword(credentials.password, user.password)) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role_id: user.role_id ?? "",
          user_type: user.user_type,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role_id = (user as { role_id?: string }).role_id ?? "";
        token.user_type = (user as { user_type?: string }).user_type ?? "";
        token.valid = true;
        token.lastChecked = Date.now();
        token.permission_ids = await fetchPermissionIds(
          token.role_id as string,
        );
        return token;
      }

      const forceRefresh = trigger === "update";

      const now = Date.now();
      const lastChecked = (token.lastChecked as number) ?? 0;

      if (forceRefresh || now - lastChecked >= USER_RECHECK_MS) {
        try {
          await connectDB();
          const dbUser = await AppUser.findById(token.id)
            .select("status role_id")
            .lean();

          if (!dbUser || (dbUser as { status: string }).status !== "Active") {
            token.valid = false;
          } else {
            token.valid = true;
            token.lastChecked = now;
            const currentRoleId =
              (dbUser as { role_id?: string }).role_id ??
              (token.role_id as string);
            token.role_id = currentRoleId;
            token.permission_ids = await fetchPermissionIds(
              currentRoleId as string,
            );
          }
        } catch {
          // DB unreachable – keep existing state to avoid false logouts
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.valid === false) {
        session.user = {} as typeof session.user;
        return session;
      }

      if (session.user) {
        session.user.id = token.id as string;
        session.user.role_id = token.role_id as string;
        session.user.user_type = token.user_type as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

async function fetchPermissionIds(roleId: string): Promise<string[]> {
  if (!roleId) return [];
  try {
    await connectDB();
    const doc = await RolePermission.findOne({ role_id: roleId })
      .select("permission_ids")
      .lean();
    return (doc as { permission_ids?: string[] })?.permission_ids ?? [];
  } catch {
    return [];
  }
}
