import "server-only";
import { productionAuditListSchema } from "@/modules/admin/production-audit";
import type { AuthService } from "@/server/services/auth-service";
import type { ProductionAuditService } from "@/server/services/production-audit-service";
import { requireRole } from "@/server/auth/guards";
import { queryObject, validate } from "@/server/http/request";
export class ProductionAuditController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: ProductionAuditService,
  ) {}
  async list(request: Request) {
    const actor = requireRole(await this.auth.currentUser(), "SYSTEM_ADMIN");
    return this.audit.list(
      actor,
      validate(productionAuditListSchema, queryObject(request)),
    );
  }
}
