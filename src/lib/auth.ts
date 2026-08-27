export const supportedProviders = ["github", "google"] as const;

export type AuthProvider = (typeof supportedProviders)[number];

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  provider: string;
}

export interface AuthConfig {
  url: string;
  key: string;
}

export const SESSION_COOKIE = "phlox_session";

export function authConfig(): AuthConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function isAuthProvider(value: string): value is AuthProvider {
  return (supportedProviders as readonly string[]).includes(value);
}

/**
 * Only same-origin paths are accepted so a crafted `next` parameter cannot
 * bounce a signed-in visitor to an attacker-controlled origin.
 */
export function isSafeRedirect(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

export function authorizeUrl(
  config: AuthConfig,
  provider: AuthProvider,
  callbackUrl: string,
  next: string,
): string {
  const redirect = new URL(callbackUrl);
  redirect.searchParams.set("next", isSafeRedirect(next) ? next : "/");

  const authorize = new URL(`${config.url}/auth/v1/authorize`);
  authorize.searchParams.set("provider", provider);
  authorize.searchParams.set("redirect_to", redirect.toString());
  return authorize.toString();
}

interface SupabaseUserPayload {
  id?: unknown;
  email?: unknown;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseSessionUser(payload: unknown): SessionUser | null {
  if (!payload || typeof payload !== "object") return null;
  const user = payload as SupabaseUserPayload;
  const id = text(user.id);
  if (!id) return null;

  const metadata = user.user_metadata || {};
  const email = text(user.email);
  const name =
    text(metadata.user_name) ||
    text(metadata.preferred_username) ||
    text(metadata.full_name) ||
    text(metadata.name) ||
    email.split("@")[0] ||
    "Signed in";

  return {
    id,
    name,
    email,
    avatarUrl: text(metadata.avatar_url) || text(metadata.picture),
    provider: text((user.app_metadata || {}).provider),
  };
}

/** Reads the Supabase user behind an access token. Returns null when invalid. */
export async function fetchSessionUser(
  config: AuthConfig,
  accessToken: string,
): Promise<SessionUser | null> {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return parseSessionUser(await response.json());
}
