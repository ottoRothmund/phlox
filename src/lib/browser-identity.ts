const visitorStorageKey = "phlox.visitor-id.v1";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Holds the identity for this page session so a browser that blocks storage still
// sends one stable id; otherwise every toggle would count as a different visitor.
let sessionVisitorId: string | null = null;

export function getBrowserVisitorId(): string {
  if (sessionVisitorId) return sessionVisitorId;

  try {
    const stored = window.localStorage.getItem(visitorStorageKey);
    if (stored && uuidPattern.test(stored)) {
      sessionVisitorId = stored;
      return stored;
    }

    const created = window.crypto.randomUUID();
    window.localStorage.setItem(visitorStorageKey, created);
    sessionVisitorId = created;
    return created;
  } catch {
    sessionVisitorId = window.crypto.randomUUID();
    return sessionVisitorId;
  }
}
