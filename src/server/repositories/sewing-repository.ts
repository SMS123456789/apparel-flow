import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.generated";
import type { SewingListInput } from "@/modules/sewing/schemas";
import type {
  SewingBatch,
  SewingDetail,
  SewingPage,
} from "@/modules/sewing/types";
import { ExternalServiceError, ValidationError } from "@/server/http/errors";
import { translateDatabaseError } from "./admin-user-repository";
export interface SewingRepository {
  list(input: SewingListInput): Promise<SewingPage>;
  find(id: string): Promise<SewingDetail | null>;
  start(actorId: string, id: string, revision: number): Promise<void>;
}
const rowSchema = z.object({
  id: z.uuid(),
  order_no: z.string(),
  status: z.literal("VERIFIED"),
  revision: z.number().int().nonnegative(),
  target_qty: z.number().int().positive(),
  created_at: z.string(),
  sewing_started_at: z.string().nullable(),
  started_by: z.uuid().nullable(),
  recipe_code_snapshot: z.string(),
  recipe_name_snapshot: z.string(),
  fabric_roll_id_snapshot: z.string(),
  wastage_cap_pct: z.string(),
  log_id: z.uuid(),
  attempt_id: z.uuid(),
  verifier_id: z.uuid(),
  verifier_name_snapshot: z.string(),
  verified_at: z.string(),
  actual_fabric_yds: z.string(),
  expected_fabric_yds: z.string(),
  wastage_pct: z.string(),
});
function batch(row: unknown) {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) throw new ExternalServiceError();
  const r = parsed.data;
  const result: SewingBatch = {
    id: r.id,
    orderNo: r.order_no,
    recipeCode: r.recipe_code_snapshot,
    recipeName: r.recipe_name_snapshot,
    targetQty: r.target_qty,
    status: r.status,
    revision: r.revision,
    createdAt: r.created_at,
    verifiedAt: r.verified_at,
    verifierId: r.verifier_id,
    verifierName: r.verifier_name_snapshot,
    fabricRollId: r.fabric_roll_id_snapshot,
    actualFabricYards: r.actual_fabric_yds,
    expectedFabricYards: r.expected_fabric_yds,
    wastagePct: r.wastage_pct,
    wastageCapPct: r.wastage_cap_pct,
    sewingStartedAt: r.sewing_started_at,
    startedBy: r.started_by,
  };
  return { result, row: r };
}
export class SupabaseSewingRepository implements SewingRepository {
  constructor(
    private readonly read: SupabaseClient<Database>,
    private readonly command: SupabaseClient<Database>,
  ) {}
  async list(input: SewingListInput) {
    // Fixed filter is part of the query, independent of browser parameters and RLS.
    let query = this.read
      .from("sewing_batches")
      .select("*")
      .eq("status", "VERIFIED")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(input.limit + 1);
    if (input.search)
      query = query.ilike(
        "order_no",
        `%${input.search.replace(/[\\%_]/g, "\\$&")}%`,
      );
    if (input.cursor) {
      let cursor;
      try {
        cursor = z
          .strictObject({
            createdAt: z.iso.datetime({ offset: true }),
            id: z.uuid(),
          })
          .parse(
            JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")),
          );
      } catch {
        throw new ValidationError({
          cursor: ["Use the cursor returned by this list."],
        });
      }
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      );
    }
    const { data, error } = await query;
    if (error) throw new ExternalServiceError();
    const items = data.slice(0, input.limit).map((r) => batch(r).result),
      last = items.at(-1);
    return {
      items,
      nextCursor:
        data.length > input.limit && last
          ? Buffer.from(
              JSON.stringify({ createdAt: last.createdAt, id: last.id }),
            ).toString("base64url")
          : null,
    };
  }
  async find(id: string) {
    const { data, error } = await this.read
      .from("sewing_batches")
      .select("*")
      .eq("status", "VERIFIED")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ExternalServiceError();
    if (!data) return null;
    const { result, row } = batch(data);
    const { data: items, error: itemError } = await this.read
      .from("verification_log_items")
      .select("*")
      .eq("log_id", row.log_id)
      .order("component_name_snapshot");
    if (
      itemError ||
      !items.length ||
      items.some((i) => i.actual_qty === null || i.actual_qty < i.expected_qty)
    )
      throw new ExternalServiceError();
    return {
      ...result,
      evidence: {
        id: row.log_id,
        attemptId: row.attempt_id,
        decision: "APPROVED" as const,
        verifierId: result.verifierId,
        verifierName: result.verifierName,
        createdAt: result.verifiedAt,
        reason: null,
        actualFabricYards: result.actualFabricYards,
        expectedFabricYards: result.expectedFabricYards,
        wastagePct: result.wastagePct,
        items: items.map((i) => ({
          componentId: i.component_id,
          name: i.component_name_snapshot,
          expectedQty: i.expected_qty,
          actualQty: i.actual_qty,
          status: i.status,
        })),
      },
    };
  }
  async start(actorId: string, id: string, revision: number) {
    const { error } = await this.command.rpc("sewing_start", {
      p_actor_id: actorId,
      p_order_id: id,
      p_revision: revision,
    });
    if (error) translateDatabaseError(error);
  }
}
