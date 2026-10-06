import { OrderController } from "@/server/controllers/order-controller";
import { createAuthService } from "@/server/auth/context";
import { createOrderService } from "@/server/production-context";
import { apiResponse } from "@/server/http/request";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(async (headers) => {
    const controller = new OrderController(
      await createAuthService(headers),
      await createOrderService(headers),
    );
    return { data: await controller.list(request) };
  });
}
export async function POST(request: Request) {
  return apiResponse(async (headers) => {
    const controller = new OrderController(
      await createAuthService(headers),
      await createOrderService(headers),
    );
    return { data: await controller.create(request), status: 201 };
  });
}
