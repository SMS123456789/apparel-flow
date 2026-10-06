import { OrderController } from "@/server/controllers/order-controller";
import { createAuthService } from "@/server/auth/context";
import { createOrderService } from "@/server/production-context";
import { apiResponse } from "@/server/http/request";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return apiResponse(async (headers) => {
    const { id } = await context.params;
    const controller = new OrderController(
      await createAuthService(headers),
      await createOrderService(headers),
    );
    return { data: await controller.detail(id) };
  });
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return apiResponse(async (headers) => {
    const { id } = await context.params;
    const controller = new OrderController(
      await createAuthService(headers),
      await createOrderService(headers),
    );
    return { data: await controller.edit(request, id) };
  });
}
