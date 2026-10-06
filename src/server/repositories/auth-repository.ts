import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import type { AuthIdentity } from "@/modules/identity/types";
import type { LoginInput } from "@/modules/identity/schemas";
import {
  AuthenticationError,
  ConflictError,
  ExternalServiceError,
  ValidationError,
} from "@/server/http/errors";
export interface AuthRepository {
  signIn(input: LoginInput): Promise<AuthIdentity>;
  currentIdentity(): Promise<AuthIdentity | null>;
  signOut(): Promise<void>;
}
export class SupabaseAuthRepository implements AuthRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async signIn(input: LoginInput) {
    const { data, error } = await this.client.auth.signInWithPassword(input);
    if (error) {
      if (
        (error.status && (error.status >= 500 || error.status === 429)) ||
        error.name === "AuthRetryableFetchError"
      )
        throw new ExternalServiceError();
      throw new AuthenticationError();
    }
    if (!data.user?.email) throw new AuthenticationError();
    return { id: data.user.id, email: data.user.email };
  }
  async currentIdentity() {
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      if (
        (error.status && (error.status >= 500 || error.status === 429)) ||
        error.name === "AuthRetryableFetchError"
      )
        throw new ExternalServiceError();
      return null;
    }
    if (!data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  }
  async signOut() {
    const { error } = await this.client.auth.signOut({ scope: "local" });
    if (error && ![401, 403, 404].includes(error.status ?? 0))
      throw new ExternalServiceError();
  }
}
export interface AuthAdminRepository {
  createUser(email: string, password: string): Promise<AuthIdentity>;
  deleteIncompleteUser(id: string): Promise<void>;
}
export class SupabaseAuthAdminRepository implements AuthAdminRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async createUser(email: string, password: string) {
    const { data, error } = await this.client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      if (["email_exists", "user_already_exists"].includes(error.code ?? ""))
        throw new ConflictError("An account already uses this email.");
      if (
        [
          "weak_password",
          "validation_failed",
          "email_address_invalid",
        ].includes(error.code ?? "")
      )
        throw new ValidationError({
          temporaryPassword: [
            "The email or password does not meet the project policy.",
          ],
        });
      throw new ExternalServiceError();
    }
    if (!data.user?.email) throw new ExternalServiceError();
    return { id: data.user.id, email: data.user.email };
  }
  async deleteIncompleteUser(id: string) {
    const { error } = await this.client.auth.admin.deleteUser(id);
    if (error) throw new ExternalServiceError();
  }
}
