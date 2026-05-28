import { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role_id?: string;
      user_type?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role_id?: string;
    user_type?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role_id?: string;
    user_type?: string;
    /** Edge-middleware-only list. APIs and UI use live DB reads. */
    permission_ids?: string[];
    /** false when the user no longer exists in DB or has been deactivated. */
    valid?: boolean;
    /** Unix ms timestamp of the last DB existence check. */
    lastChecked?: number;
  }
}
