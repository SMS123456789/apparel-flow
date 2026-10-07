import "server-only";
import type { AuthenticatedUser } from "@/modules/identity/types";
import type { ProductionAuditInput } from "@/modules/admin/production-audit";
import type { ProductionAuditRepository } from "@/server/repositories/production-audit-repository";
import { requireRole } from "@/server/auth/guards";
export class ProductionAuditService {
  constructor(private readonly audit: ProductionAuditRepository) {}
  list(actor: AuthenticatedUser, input: ProductionAuditInput) {
    requireRole(actor, "SYSTEM_ADMIN");
    return this.audit.list(actor.id, input);
  }
}
