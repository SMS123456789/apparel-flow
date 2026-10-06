import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.generated";
import { roles, type ApplicationProfile } from "@/modules/identity/types";
import { ExternalServiceError } from "@/server/http/errors";
export function applicationRole(role: string) {
  return z.enum(roles).parse(role.toUpperCase());
}
export interface ProfileRepository {
  findOwn(id: string): Promise<ApplicationProfile | null>;
}
export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async findOwn(id: string) {
    const { data, error } = await this.client
      .from("profiles")
      .select("id,full_name,role,is_active")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ExternalServiceError();
    return data
      ? {
          id: data.id,
          fullName: data.full_name,
          role: applicationRole(data.role),
          isActive: data.is_active,
        }
      : null;
  }
}
