import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Tables } from "@/types/database.generated";
import type {
  CreateOrderInput,
  EditOrderInput,
  OrderListInput,
} from "@/modules/orders/schemas";
import type {
  OrderDetail,
  OrderPage,
  OrderSummary,
} from "@/modules/orders/types";
import { expectedFabric, requirements } from "@/modules/orders/calculations";
import { recipeOutput } from "./recipe-repository";
import { translateDatabaseError } from "./admin-user-repository";
import { ExternalServiceError, ValidationError } from "@/server/http/errors";
export interface OrderRepository {
  list(input: OrderListInput): Promise<OrderPage>;
  find(id: string): Promise<OrderDetail | null>;
  create(actorId: string, input: CreateOrderInput): Promise<string>;
  edit(actorId: string, id: string, input: EditOrderInput): Promise<void>;
  submit(actorId: string, id: string, revision: number): Promise<void>;
  recut(actorId: string, id: string, revision: number): Promise<void>;
}
function summary(
  row: Tables<"cutting_orders">,
  recipe: { name: string; recipe_code: string },
): OrderSummary {
  return {
    id: row.id,
    orderNo: row.order_no,
    recipeName: recipe.name,
    recipeCode: recipe.recipe_code,
    targetQty: row.target_qty,
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sewingStartedAt: row.sewing_started_at,
    startedBy: row.started_by,
  };
}
export class SupabaseOrderRepository implements OrderRepository {
  constructor(
    private readonly read: SupabaseClient<Database>,
    private readonly command: SupabaseClient<Database>,
  ) {}
  async list(input: OrderListInput) {
    let query = this.read
      .from("cutting_orders")
      .select("*,recipes!cutting_orders_recipe_id_fkey(name,recipe_code)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(input.limit + 1);
    if (input.status) query = query.eq("status", input.status);
    // Literal order-number search only; escape wildcard characters and disallow expression injection.
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
    const items = data
      .slice(0, input.limit)
      .map((row) => summary(row, row.recipes!));
    const last = items.at(-1);
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
    const { data: row, error } = await this.read
      .from("cutting_orders")
      .select(
        `*,recipes!cutting_orders_recipe_id_fkey(*,recipe_components(*)),order_components(*),verification_attempts!verification_attempts_order_id_recipe_id_fkey(*,verification_items(*),verification_logs!verification_logs_attempt_id_order_id_fkey(*,verification_log_items(*)))`,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ExternalServiceError();
    if (!row || !row.recipes) return null;
    const recipe = recipeOutput(row.recipes);
    const attempts = row.verification_attempts
      .toSorted((a, b) => a.attempt_no - b.attempt_no)
      .map((a) => ({
        id: a.id,
        attemptNo: a.attempt_no,
        status: a.status,
        submittedAt: a.submitted_at,
        closedAt: a.closed_at,
        fabricRollId: a.fabric_roll_id_snapshot,
        actualFabricYards: String(a.actual_fabric_yds),
        standardFabricYards: String(a.std_fabric_yards_snapshot),
        expectedFabricYards: expectedFabric(
          a.target_qty_snapshot,
          String(a.std_fabric_yards_snapshot),
        ),
        wastageCapPct: String(a.wastage_cap_pct_snapshot),
        items: a.verification_items.map((i) => ({
          componentId: i.component_id,
          expectedQty: i.expected_qty,
          actualQty: i.actual_qty,
          status: i.status,
        })),
      }));
    const components = row.first_submitted_at
      ? row.order_components
          .toSorted((a, b) => a.sort_order - b.sort_order)
          .map((c) => ({
            componentId: c.component_id,
            name: c.component_name_snapshot,
            piecesPerGarment: c.pieces_per_garment,
            expectedQty: c.expected_qty,
            sortOrder: c.sort_order,
          }))
      : requirements(recipe, row.target_qty);
    return {
      ...summary(row, row.recipes),
      recipe,
      fabricRollId: row.fabric_roll_id,
      actualFabricYards: String(row.actual_fabric_yds),
      expectedFabricYards: expectedFabric(
        row.target_qty,
        attempts[0]?.standardFabricYards ?? recipe.standardFabricYards,
      ),
      createdBy: row.created_by,
      firstSubmittedAt: row.first_submitted_at,
      currentAttemptId: row.current_attempt_id,
      approvedLogId: row.approved_log_id,
      components,
      attempts,
      evidence: row.verification_attempts
        .flatMap((a) => a.verification_logs)
        .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
        .map((l) => ({
          id: l.id,
          attemptId: l.attempt_id,
          decision: l.decision,
          verifierId: l.verifier_id,
          verifierName: l.verifier_name_snapshot,
          createdAt: l.created_at,
          reason: l.rejection_note,
          actualFabricYards: String(l.actual_fabric_yds),
          expectedFabricYards: String(l.expected_fabric_yds),
          wastagePct: String(l.wastage_pct),
          items: l.verification_log_items.map((i) => ({
            componentId: i.component_id,
            name: i.component_name_snapshot,
            expectedQty: i.expected_qty,
            actualQty: i.actual_qty,
            status: i.status,
          })),
        })),
    };
  }
  async create(actorId: string, input: CreateOrderInput) {
    const { data, error } = await this.command.rpc("cutting_create", {
      p_actor_id: actorId,
      p_recipe_id: input.recipeId,
      p_target_qty: input.targetQty,
      p_fabric_roll_id: input.fabricRollId,
      p_actual_fabric: input.actualFabricYards,
    });
    if (error) translateDatabaseError(error);
    if (!data) throw new ExternalServiceError();
    return data;
  }
  async edit(actorId: string, id: string, input: EditOrderInput) {
    const { error } = await this.command.rpc("cutting_edit", {
      p_actor_id: actorId,
      p_order_id: id,
      p_revision: input.expectedRevision,
      ...(input.recipeId !== undefined ? { p_recipe_id: input.recipeId } : {}),
      ...(input.targetQty !== undefined
        ? { p_target_qty: input.targetQty }
        : {}),
      ...(input.fabricRollId !== undefined
        ? { p_fabric_roll_id: input.fabricRollId }
        : {}),
      ...(input.actualFabricYards !== undefined
        ? { p_actual_fabric: input.actualFabricYards }
        : {}),
    });
    if (error) translateDatabaseError(error);
  }
  async submit(actorId: string, id: string, revision: number) {
    const { error } = await this.command.rpc("cutting_submit", {
      p_actor_id: actorId,
      p_order_id: id,
      p_revision: revision,
    });
    if (error) translateDatabaseError(error);
  }
  async recut(actorId: string, id: string, revision: number) {
    const { error } = await this.command.rpc("cutting_recut", {
      p_actor_id: actorId,
      p_order_id: id,
      p_revision: revision,
    });
    if (error) translateDatabaseError(error);
  }
}
