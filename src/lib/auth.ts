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

/**
 * Public origin for a request, as the browser sees it.
 *
 * `request.url` is the origin the Node server itself is listening on, which
 * behind a reverse proxy (Fly, Railway, Cloudflare, nginx) is an internal
 * address like `http://localhost:3000`. Using it for an OAuth callback sends
 * the user to a host that only exists inside the container.
 *
 * Order: the configured canonical origin wins, then the proxy's forwarded
 * headers, then whatever the request itself claims.
 */
export function publicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through; a malformed env var should not break sign-in.
    }
  }

  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (forwardedHost) {
    // Take the first value: proxies chain these as a comma-separated list.
    const host = forwardedHost.split(",")[0]?.trim();
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")
        ? "http"
        : "https");
    if (host && /^[a-z0-9.:_-]+$/i.test(host)) {
      return `${proto}://${host}`;
    }
  }

  return new URL(request.url).origin;
}

export function callbackUrl(request: Request): string {
  return new URL("/api/auth/callback", publicOrigin(request)).toString();
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
