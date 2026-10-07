import { ProductionAuditController } from "@/server/controllers/production-audit-controller";
import { createAuthService } from "@/server/auth/context";
import { createProductionAuditService } from "@/server/production-audit-context";
import { apiResponse } from "@/server/http/request";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(async (headers) => {
    const controller = new ProductionAuditController(
      await createAuthService(headers),
      createProductionAuditService(),
    );
    return { data: await controller.list(request) };
  });
}
