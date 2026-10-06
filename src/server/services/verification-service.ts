import "server-only";
import type { AuthenticatedUser } from "@/modules/identity/types";
import type {
  SaveCountsInput,
  DecisionInput,
  RejectInput,
  VerificationListInput,
} from "@/modules/verification/schemas";
import {
  approvalViolations,
  wastagePercentage,
} from "@/modules/verification/rules";
import { requireRole } from "@/server/auth/guards";
import {
  ApprovalBlockedError,
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "@/server/http/errors";
import type { OrderRepository } from "@/server/repositories/order-repository";
import type { VerificationRepository } from "@/server/repositories/verification-repository";
export class VerificationService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly verification: VerificationRepository,
  ) {}
  queue(actor: AuthenticatedUser, input: VerificationListInput) {
    requireRole(actor, "CUTTING_VERIFIER");
    return this.orders.list({ ...input, status: "PENDING_VERIFICATION" });
  }
  history(actor: AuthenticatedUser, input: VerificationListInput) {
    requireRole(actor, "CUTTING_VERIFIER");
    return this.orders.list(input, true);
  }
  async detail(actor: AuthenticatedUser, id: string) {
    requireRole(actor, "CUTTING_VERIFIER");
    const order = await this.orders.find(id);
    if (!order || !order.firstSubmittedAt) throw new NotFoundError();
    return order;
  }
  private async open(
    actor: AuthenticatedUser,
    id: string,
    input: DecisionInput,
  ) {
    const order = await this.detail(actor, id);
    if (order.createdBy === actor.id)
      throw new AuthorizationError(
        "An order creator cannot verify their own batch, including after a role change.",
      );
    const attempt = order.attempts.find((a) => a.id === input.attemptId);
    if (
      order.status !== "PENDING_VERIFICATION" ||
      order.revision !== input.expectedRevision ||
      order.currentAttemptId !== input.attemptId ||
      attempt?.status !== "OPEN"
    )
      throw new ConflictError();
    return { order, attempt };
  }
  async save(actor: AuthenticatedUser, id: string, input: SaveCountsInput) {
    const { order } = await this.open(actor, id, input);
    if (
      input.items.some(
        (i) => !order.components.some((c) => c.componentId === i.componentId),
      )
    )
      throw new BusinessRuleError(
        "Counts must belong to this batch's frozen component manifest.",
      );
    await this.verification.save(actor.id, id, input);
    return this.detail(actor, id);
  }
  async approve(actor: AuthenticatedUser, id: string, input: DecisionInput) {
    const { order, attempt } = await this.open(actor, id, input);
    const violations = approvalViolations(order.components, attempt.items);
    if (violations.length) throw new ApprovalBlockedError(violations);
    // Services own analytics; the locked SQL command independently recomputes the same signed result.
    wastagePercentage(attempt.actualFabricYards, attempt.expectedFabricYards);
    await this.verification.approve(actor.id, id, input);
    return this.detail(actor, id);
  }
  async reject(actor: AuthenticatedUser, id: string, input: RejectInput) {
    await this.open(actor, id, input);
    const reason = input.reason.trim();
    if (!reason || reason.length > 1000)
      throw new BusinessRuleError(
        "Enter a rejection reason of 1–1000 characters.",
      );
    await this.verification.reject(actor.id, id, { ...input, reason });
    return this.detail(actor, id);
  }
}
