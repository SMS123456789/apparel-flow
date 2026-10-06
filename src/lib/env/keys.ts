// Inspect only the legacy API-key role, not a user's identity or authority.
// Supabase must still validate the actual key on every network request.
function legacyKeyRole(key: string): unknown {
  try {
    const payload = key.split(".")[1];
    if (!payload) return undefined;
    const claims: unknown = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (typeof claims !== "object" || claims === null) return undefined;
    return "role" in claims ? claims.role : undefined;
  } catch {
    return undefined;
  }
}

export function isPublishableKey(key: string): boolean {
  return (
    /^sb_publishable_[A-Za-z0-9_-]+$/.test(key) || legacyKeyRole(key) === "anon"
  );
}

export function isSecretKey(key: string): boolean {
  return (
    /^sb_secret_[A-Za-z0-9_-]+$/.test(key) ||
    legacyKeyRole(key) === "service_role"
  );
}
