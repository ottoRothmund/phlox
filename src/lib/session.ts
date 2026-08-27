import { cookies } from "next/headers";

import { SESSION_COOKIE, authConfig, fetchSessionUser, type SessionUser } from "@/lib/auth";

/** Resolves the signed-in visitor for server components. Never throws. */
export async function currentUser(): Promise<SessionUser | null> {
  const config = authConfig();
  if (!config) return null;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await fetchSessionUser(config, token);
  } catch {
    return null;
  }
}
