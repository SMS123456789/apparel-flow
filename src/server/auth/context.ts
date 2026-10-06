import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  SupabaseAuthRepository,
  SupabaseAuthAdminRepository,
} from "@/server/repositories/auth-repository";
import { SupabaseProfileRepository } from "@/server/repositories/profile-repository";
import { SupabaseAdminUserRepository } from "@/server/repositories/admin-user-repository";
import { AuthService } from "@/server/services/auth-service";
import { AdminUserService } from "@/server/services/admin-user-service";
import { AuthenticationError, AuthorizationError } from "@/server/http/errors";
import { rolePaths, type AppRole } from "@/modules/identity/types";
export async function createAuthService(headers: Headers, readOnly = false) {
  const client = await createServerSupabaseClient(headers, readOnly);
  return new AuthService(
    new SupabaseAuthRepository(client),
    new SupabaseProfileRepository(client),
  );
}
export function createAdminUserService() {
  const client = createAdminSupabaseClient();
  return new AdminUserService(
    new SupabaseAuthAdminRepository(client),
    new SupabaseAdminUserRepository(client),
  );
}
export async function getCurrentUser() {
  return (await createAuthService(new Headers(), true)).currentUser();
}
export async function getPageUser(role: AppRole) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    if (error instanceof AuthorizationError)
      redirect("/login?access=unavailable");
    throw error;
  }
  if (user.role !== role) redirect(rolePaths[user.role]);
  return user;
}
