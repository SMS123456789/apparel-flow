import "server-only";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.generated";
import type {
  ApplicationProfile,
  ProductionRole,
} from "@/modules/identity/types";
import type {
  AdminUser,
  AdminAuditEvent,
  PageResult,
} from "@/modules/admin/types";
import {
  cursorSchema,
  type ListUsersInput,
  type ListAuditInput,
} from "@/modules/admin/schemas";
import { applicationRole } from "./profile-repository";
import {
  AuthorizationError,
  ConflictError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "@/server/http/errors";
export interface AdminUserRepository {
  list(actorId: string, input: ListUsersInput): Promise<PageResult<AdminUser>>;
  createProfile(
    actorId: string,
    userId: string,
    fullName: string,
    role: ProductionRole,
    requestId: string,
  ): Promise<AdminUser>;
  findProfile(id: string): Promise<ApplicationProfile | null>;
  update(
    actorId: string,
    userId: string,
    revision: number,
    change: { role?: ProductionRole; isActive?: boolean },
    requestId: string,
  ): Promise<AdminUser>;
  audit(
    actorId: string,
    input: ListAuditInput,
  ): Promise<PageResult<AdminAuditEvent>>;
}
export function translateDatabaseError(
  error: Pick<PostgrestError, "code">,
): never {
  if (error.code === "42501") throw new AuthorizationError();
  if (error.code === "P0002") throw new NotFoundError();
  if (["40001", "23505"].includes(error.code)) throw new ConflictError();
  if (["22023", "23514", "22P02"].includes(error.code))
    throw new ValidationError();
  throw new ExternalServiceError();
}
const userRow = z.object({
  id: z.uuid(),
  email: z.string(),
  full_name: z.string(),
  role: z.string(),
  is_active: z.boolean(),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  created_at: z.string(),
  updated_at: z.string(),
});
function userOutput(raw: unknown): AdminUser {
  const row = userRow.parse(raw);
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: applicationRole(row.role),
    isActive: row.is_active,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function cursorArguments(cursor?: string) {
  if (!cursor) return {};
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("Invalid cursor");
    const parsed = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown,
    );
    return { p_cursor_time: parsed.createdAt, p_cursor_id: parsed.id };
  } catch {
    throw new ValidationError({
      cursor: ["Use a cursor returned by this list."],
    });
  }
}
function page<T extends { id: string; createdAt: string }>(
  rows: T[],
  limit: number,
): PageResult<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(
            JSON.stringify({ createdAt: last.createdAt, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
export class SupabaseAdminUserRepository implements AdminUserRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async list(actorId: string, input: ListUsersInput) {
    const { data, error } = await this.client.rpc("admin_list_users", {
      p_actor_id: actorId,
      p_limit: input.limit,
      ...cursorArguments(input.cursor),
      ...(input.search ? { p_search: input.search } : {}),
      ...(input.role
        ? {
            p_role:
              input.role.toLowerCase() as Database["public"]["Enums"]["app_role"],
          }
        : {}),
      ...(input.active ? { p_active: input.active === "true" } : {}),
    });
    if (error) translateDatabaseError(error);
    return page(z.array(z.unknown()).parse(data).map(userOutput), input.limit);
  }
  async createProfile(
    actorId: string,
    userId: string,
    fullName: string,
    role: ProductionRole,
    requestId: string,
  ) {
    const { data, error } = await this.client.rpc("admin_create_profile", {
      p_actor_id: actorId,
      p_user_id: userId,
      p_full_name: fullName,
      p_role: role.toLowerCase() as Database["public"]["Enums"]["app_role"],
      p_request_id: requestId,
    });
    if (error) translateDatabaseError(error);
    return userOutput(data);
  }
  async findProfile(id: string) {
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
  async update(
    actorId: string,
    userId: string,
    revision: number,
    change: { role?: ProductionRole; isActive?: boolean },
    requestId: string,
  ) {
    const { data, error } = await this.client.rpc("admin_update_profile", {
      p_actor_id: actorId,
      p_user_id: userId,
      p_expected_revision: revision,
      p_request_id: requestId,
      ...(change.role
        ? {
            p_role:
              change.role.toLowerCase() as Database["public"]["Enums"]["app_role"],
          }
        : {}),
      ...(change.isActive === undefined ? {} : { p_active: change.isActive }),
    });
    if (error) translateDatabaseError(error);
    return userOutput(data);
  }
  async audit(actorId: string, input: ListAuditInput) {
    const { data, error } = await this.client.rpc("admin_list_audit", {
      p_actor_id: actorId,
      p_limit: input.limit,
      ...cursorArguments(input.cursor),
    });
    if (error) translateDatabaseError(error);
    const schema = z.object({
      id: z.uuid(),
      actor_id: z.uuid(),
      actor_name: z.string(),
      target_user_id: z.uuid(),
      target_name: z.string(),
      action: z.enum([
        "USER_CREATED",
        "USER_ROLE_CHANGED",
        "USER_ACTIVATED",
        "USER_DEACTIVATED",
      ]),
      before_state: z.record(z.string(), z.unknown()),
      after_state: z.record(z.string(), z.unknown()),
      request_id: z.uuid(),
      created_at: z.string(),
    });
    const rows = z
      .array(schema)
      .parse(data)
      .map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actorName: row.actor_name,
        targetUserId: row.target_user_id,
        targetName: row.target_name,
        action: row.action,
        beforeState: row.before_state,
        afterState: row.after_state,
        requestId: row.request_id,
        createdAt: row.created_at,
      }));
    return page(rows, input.limit);
  }
}
