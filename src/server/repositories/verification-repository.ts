import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.generated";
import type {
  SaveCountsInput,
  DecisionInput,
  RejectInput,
} from "@/modules/verification/schemas";
import { ApprovalBlockedError } from "@/server/http/errors";
import { translateDatabaseError } from "./admin-user-repository";
export interface VerificationRepository {
  save(actorId: string, orderId: string, input: SaveCountsInput): Promise<void>;
  approve(
    actorId: string,
    orderId: string,
    input: DecisionInput,
  ): Promise<void>;
  reject(actorId: string, orderId: string, input: RejectInput): Promise<void>;
}
export function translateVerificationError(
  error: Pick<PostgrestError, "code" | "details">,
): never {
  if (error.code === "P0422") {
    let raw: unknown = [];
    try {
      raw = JSON.parse(error.details);
    } catch {}
    const result = z
      .array(
        z.object({
          componentId: z.uuid().optional(),
          reason: z.enum(["SHORTAGE", "UNCOUNTED", "MISSING_COMPONENT"]),
        }),
      )
      .safeParse(raw);
    throw new ApprovalBlockedError(
      result.success
        ? result.data.map((v) => ({
            reason: v.reason,
            ...(v.componentId ? { componentId: v.componentId } : {}),
          }))
        : [],
    );
  }
  return translateDatabaseError(error);
}
export class SupabaseVerificationRepository implements VerificationRepository {
  constructor(private readonly command: SupabaseClient<Database>) {}
  async save(actorId: string, orderId: string, input: SaveCountsInput) {
    const { error } = await this.command.rpc("verification_save", {
      p_actor_id: actorId,
      p_order_id: orderId,
      p_attempt_id: input.attemptId,
      p_revision: input.expectedRevision,
      p_items: input.items,
    });
    if (error) translateVerificationError(error);
  }
  async approve(actorId: string, orderId: string, input: DecisionInput) {
    const { error } = await this.command.rpc("verification_approve", {
      p_actor_id: actorId,
      p_order_id: orderId,
      p_attempt_id: input.attemptId,
      p_revision: input.expectedRevision,
    });
    if (error) translateVerificationError(error);
  }
  async reject(actorId: string, orderId: string, input: RejectInput) {
    const { error } = await this.command.rpc("verification_reject", {
      p_actor_id: actorId,
      p_order_id: orderId,
      p_attempt_id: input.attemptId,
      p_revision: input.expectedRevision,
      p_reason: input.reason,
    });
    if (error) translateVerificationError(error);
  }
}
