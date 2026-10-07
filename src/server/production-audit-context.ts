import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseProductionAuditRepository } from "./repositories/production-audit-repository";
import { ProductionAuditService } from "./services/production-audit-service";
export function createProductionAuditService() {
  return new ProductionAuditService(
    new SupabaseProductionAuditRepository(createAdminSupabaseClient()),
  );
}
