import type { AppRole, AuthenticatedUser } from "@/modules/identity/types";
import { AuthenticationError, AuthorizationError } from "@/server/http/errors";
export function requireUser(user: AuthenticatedUser | null): AuthenticatedUser {
  if (!user) throw new AuthenticationError();
  if (!user.isActive) throw new AuthorizationError();
  return user;
}
export function requireRole(
  user: AuthenticatedUser | null,
  ...allowed: AppRole[]
): AuthenticatedUser {
  const identity = requireUser(user);
  if (!allowed.includes(identity.role)) throw new AuthorizationError();
  return identity;
}
