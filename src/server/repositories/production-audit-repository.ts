import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.generated";
import {
  compareProductionEvents,
  productionAuditCursorSchema,
  productionCursorFilter,
  type ProductionAuditCursor,
  type ProductionAuditEvent,
  type ProductionAuditInput,
  type ProductionAuditPage,
} from "@/modules/admin/production-audit";
import {
  AuthorizationError,
  ExternalServiceError,
  ValidationError,
} from "@/server/http/errors";

export interface ProductionAuditRepository {
  list(
    actorId: string,
    input: ProductionAuditInput,
  ): Promise<ProductionAuditPage>;
}
const decisionSchema = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  attempt_id: z.uuid(),
  created_at: z.string(),
  verifier_id: z.uuid(),
  verifier_name_snapshot: z.string(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  rejection_note: z.string().nullable(),
  expected_fabric_yds: z.string(),
  actual_fabric_yds: z.string(),
  wastage_pct: z.string(),
});
const sewingSchema = z.object({
  id: z.uuid(),
  order_no: z.string(),
  status: z.literal("VERIFIED"),
  sewing_started_at: z.string(),
  started_by: z.uuid(),
  approved_log_id: z.uuid(),
  current_attempt_id: z.uuid(),
});
function checked<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ExternalServiceError();
  return result.data;
}
export class SupabaseProductionAuditRepository implements ProductionAuditRepository {
  // This elevated client is confined to SELECTs in this admin-only projection.
  // Existing production APIs, RLS, grants and transactional commands are unchanged.
  constructor(private readonly read: SupabaseClient<Database>) {}
  async list(
    actorId: string,
    input: ProductionAuditInput,
  ): Promise<ProductionAuditPage> {
    const { data: actor, error: actorError } = await this.read
      .from("profiles")
      .select("id")
      .eq("id", actorId)
      .eq("role", "system_admin")
      .eq("is_active", true)
      .maybeSingle();
    if (actorError) throw new ExternalServiceError();
    if (!actor) throw new AuthorizationError();
    let cursor: ProductionAuditCursor | undefined;
    if (input.cursor) {
      try {
        cursor = productionAuditCursorSchema.parse(
          JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")),
        );
      } catch {
        throw new ValidationError({
          cursor: ["Use the cursor returned by this audit."],
        });
      }
    }
    let orders = this.read
      .from("cutting_orders")
      .select("id,order_no,created_by,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(input.limit + 1);
    let submissions = this.read
      .from("verification_attempts")
      .select(
        "id,order_id,submitted_by,submitted_at,attempt_no,recipe_name_snapshot,target_qty_snapshot,fabric_roll_id_snapshot",
      )
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(input.limit + 1);
    let decisions = this.read
      .from("verification_evidence")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(input.limit + 1);
    // sewing_batches intentionally requires an actual sewing-role JWT, even
    // for service-role reads. Aggregate the same authoritative start fields
    // here and verify the referenced approved attempt/log without changing it.
    let sewing = this.read
      .from("cutting_orders")
      .select(
        "id,order_no,status,sewing_started_at,started_by,approved_log_id,current_attempt_id",
      )
      .eq("status", "VERIFIED")
      .not("sewing_started_at", "is", null)
      .order("sewing_started_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(input.limit + 1);
    if (cursor) {
      orders = orders.or(productionCursorFilter("ORDER", "created_at", cursor));
      submissions = submissions.or(
        productionCursorFilter("SUBMISSION", "submitted_at", cursor),
      );
      decisions = decisions.or(
        productionCursorFilter("VERIFICATION", "created_at", cursor),
      );
      sewing = sewing.or(
        productionCursorFilter("SEWING", "sewing_started_at", cursor),
      );
    }
    const results = await Promise.all([orders, submissions, decisions, sewing]);
    if (results.some((r) => r.error || !r.data))
      throw new ExternalServiceError();
    const candidates = [
      ...(results[0].data ?? []).map((row) => ({
        time: row.created_at,
        source: "ORDER" as const,
        id: row.id,
        row,
      })),
      ...(results[1].data ?? []).map((row) => ({
        time: row.submitted_at,
        source: "SUBMISSION" as const,
        id: row.id,
        row,
      })),
      ...(results[2].data ?? []).map((value) => {
        const row = checked(decisionSchema, value);
        return {
          time: row.created_at,
          source: "VERIFICATION" as const,
          id: row.id,
          row,
        };
      }),
      ...(results[3].data ?? []).map((value) => {
        const row = checked(sewingSchema, value);
        return {
          time: row.sewing_started_at,
          source: "SEWING" as const,
          id: row.id,
          row,
        };
      }),
    ].sort(compareProductionEvents);
    const selected = candidates.slice(0, input.limit);
    if (!selected.length) return { items: [], nextCursor: null };
    const orderIds = [
      ...new Set(
        selected.map((e) =>
          e.source === "SUBMISSION" || e.source === "VERIFICATION"
            ? e.row.order_id
            : e.row.id,
        ),
      ),
    ];
    const attemptIds = [
      ...new Set(
        selected.flatMap((e) =>
          e.source === "ORDER"
            ? []
            : [
                e.source === "SUBMISSION"
                  ? e.id
                  : e.source === "SEWING"
                    ? e.row.current_attempt_id
                    : e.row.attempt_id,
              ],
        ),
      ),
    ];
    const actorIds = [
      ...new Set(
        selected.map((e) =>
          e.source === "ORDER"
            ? e.row.created_by
            : e.source === "SUBMISSION"
              ? e.row.submitted_by
              : e.source === "SEWING"
                ? e.row.started_by
                : e.row.verifier_id,
        ),
      ),
    ];
    const logIds = [
      ...new Set(
        selected.flatMap((e) =>
          e.source === "VERIFICATION"
            ? [e.id]
            : e.source === "SEWING"
              ? [e.row.approved_log_id]
              : [],
        ),
      ),
    ];
    const [orderRows, attemptRows, profiles, logs, components] =
      await Promise.all([
        this.read
          .from("cutting_orders")
          .select("id,order_no")
          .in("id", orderIds),
        attemptIds.length
          ? this.read
              .from("verification_attempts")
              .select(
                "id,attempt_no,status,recipe_name_snapshot,target_qty_snapshot,fabric_roll_id_snapshot",
              )
              .in("id", attemptIds)
          : { data: [], error: null },
        this.read.from("profiles").select("id,full_name").in("id", actorIds),
        logIds.length
          ? this.read.from("verification_evidence").select("*").in("id", logIds)
          : { data: [], error: null },
        logIds.length
          ? this.read
              .from("verification_log_items")
              .select("*")
              .in("log_id", logIds)
              .order("component_name_snapshot")
          : { data: [], error: null },
      ]);
    if (
      [orderRows, attemptRows, profiles, logs, components].some(
        (r) => r.error || !r.data,
      )
    )
      throw new ExternalServiceError();
    const items: ProductionAuditEvent[] = selected.map((event) => {
      const { source, id, time, row } = event;
      const orderId =
        source === "SUBMISSION" || source === "VERIFICATION"
          ? row.order_id
          : row.id;
      const order = orderRows.data?.find((o) => o.id === orderId);
      const actorId =
        source === "ORDER"
          ? row.created_by
          : source === "SUBMISSION"
            ? row.submitted_by
            : source === "SEWING"
              ? row.started_by
              : row.verifier_id;
      const name =
        source === "VERIFICATION"
          ? row.verifier_name_snapshot
          : profiles.data?.find((p) => p.id === actorId)?.full_name;
      if (!order) throw new ExternalServiceError();
      const base: ProductionAuditEvent = {
        source,
        id,
        time,
        orderId,
        orderNo: order.order_no,
        actorId,
        actorName: name ?? "Recorded actor",
        actorNameBasis:
          source === "VERIFICATION"
            ? "decision snapshot"
            : name
              ? "current account name"
              : "unavailable",
        action:
          source === "ORDER"
            ? "ORDER_CREATED"
            : source === "SUBMISSION"
              ? "SUBMITTED"
              : source === "SEWING"
                ? "SEWING_STARTED"
                : row.decision,
        summary:
          source === "ORDER"
            ? "Cutting order created"
            : source === "SUBMISSION"
              ? `Attempt ${row.attempt_no} submitted for verification`
              : source === "SEWING"
                ? "Sewing start recorded"
                : row.decision === "APPROVED"
                  ? "All required components accepted"
                  : (row.rejection_note ?? "Verification rejected"),
      };
      if (source !== "ORDER") {
        const attemptId =
          source === "SUBMISSION"
            ? id
            : source === "SEWING"
              ? row.current_attempt_id
              : row.attempt_id;
        const attempt = attemptRows.data?.find((a) => a.id === attemptId);
        if (!attempt || (source === "SEWING" && attempt.status !== "APPROVED"))
          throw new ExternalServiceError();
        if (source === "SEWING")
          base.summary = `${attempt.target_qty_snapshot.toLocaleString("en-US")} garments · ${attempt.recipe_name_snapshot}`;
        Object.assign(base, {
          attemptId,
          attemptNo: attempt.attempt_no,
          recipeName: attempt.recipe_name_snapshot,
          targetQty: attempt.target_qty_snapshot,
          fabricRollId: attempt.fabric_roll_id_snapshot,
        });
      }
      if (source === "VERIFICATION" || source === "SEWING") {
        const logId = source === "VERIFICATION" ? id : row.approved_log_id;
        const log = checked(
          decisionSchema,
          logs.data?.find((l) => l.id === logId),
        );
        const logItems =
          components.data?.filter((i) => i.log_id === logId) ?? [];
        if (
          !logItems.length ||
          log.order_id !== orderId ||
          log.attempt_id !== base.attemptId ||
          (source === "SEWING" && log.decision !== "APPROVED")
        )
          throw new ExternalServiceError();
        base.evidence = {
          id: log.id,
          attemptId: log.attempt_id,
          decision: log.decision,
          verifierId: log.verifier_id,
          verifierName: log.verifier_name_snapshot,
          createdAt: log.created_at,
          reason: log.rejection_note,
          expectedFabricYards: log.expected_fabric_yds,
          actualFabricYards: log.actual_fabric_yds,
          wastagePct: log.wastage_pct,
          items: logItems.map((i) => ({
            componentId: i.component_id,
            name: i.component_name_snapshot,
            expectedQty: i.expected_qty,
            actualQty: i.actual_qty,
            status: i.status,
          })),
        };
      }
      return base;
    });
    const last = selected.at(-1)!;
    return {
      items,
      nextCursor:
        candidates.length > input.limit
          ? Buffer.from(
              JSON.stringify({
                time: last.time,
                source: last.source,
                id: last.id,
              }),
            ).toString("base64url")
          : null,
    };
  }
}
