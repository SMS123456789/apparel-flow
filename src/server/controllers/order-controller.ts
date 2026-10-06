import "server-only";
import {
  createOrderSchema,
  editOrderSchema,
  expectedRevisionSchema,
  idSchema,
  orderListSchema,
} from "@/modules/orders/schemas";
import type { AuthService } from "@/server/services/auth-service";
import type { OrderService } from "@/server/services/order-service";
import { requireRole } from "@/server/auth/guards";
import {
  validate,
  readJson,
  requireOrigin,
  queryObject,
} from "@/server/http/request";
export class OrderController {
  constructor(
    private readonly auth: AuthService,
    private readonly orders: OrderService,
  ) {}
  private async actor() {
    return requireRole(await this.auth.currentUser(), "CUTTING_SUPERVISOR");
  }
  async list(request: Request) {
    const actor = await this.actor();
    return this.orders.list(
      actor,
      validate(orderListSchema, queryObject(request)),
    );
  }
  async detail(id: string) {
    return this.orders.detail(await this.actor(), validate(idSchema, id));
  }
  async create(request: Request) {
    const actor = await this.actor();
    requireOrigin(request);
    return this.orders.create(
      actor,
      validate(createOrderSchema, await readJson(request)),
    );
  }
  async edit(request: Request, id: string) {
    const actor = await this.actor();
    requireOrigin(request);
    return this.orders.edit(
      actor,
      validate(idSchema, id),
      validate(editOrderSchema, await readJson(request)),
    );
  }
  async submit(request: Request, id: string) {
    const actor = await this.actor();
    requireOrigin(request);
    const input = validate(expectedRevisionSchema, await readJson(request));
    return this.orders.submit(
      actor,
      validate(idSchema, id),
      input.expectedRevision,
    );
  }
  async recut(request: Request, id: string) {
    const actor = await this.actor();
    requireOrigin(request);
    const input = validate(expectedRevisionSchema, await readJson(request));
    return this.orders.recut(
      actor,
      validate(idSchema, id),
      input.expectedRevision,
    );
  }
}
