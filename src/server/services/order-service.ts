import "server-only";
import type { AuthenticatedUser } from "@/modules/identity/types";
import type {
  CreateOrderInput,
  EditOrderInput,
  OrderListInput,
} from "@/modules/orders/schemas";
import { requirements, expectedFabric } from "@/modules/orders/calculations";
import type { OrderRepository } from "@/server/repositories/order-repository";
import type { RecipeRepository } from "@/server/repositories/recipe-repository";
import { requireRole } from "@/server/auth/guards";
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "@/server/http/errors";
export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly recipes: RecipeRepository,
  ) {}
  list(actor: AuthenticatedUser, input: OrderListInput) {
    requireRole(actor, "CUTTING_SUPERVISOR");
    return this.orders.list(input);
  }
  async detail(actor: AuthenticatedUser, id: string) {
    requireRole(actor, "CUTTING_SUPERVISOR");
    const order = await this.orders.find(id);
    if (!order) throw new NotFoundError();
    return order;
  }
  private async basis(recipeId: string, targetQty: number) {
    const recipe = await this.recipes.find(recipeId);
    if (!recipe) throw new NotFoundError();
    try {
      requirements(recipe, targetQty);
      expectedFabric(targetQty, recipe.standardFabricYards);
    } catch {
      throw new BusinessRuleError(
        "The recipe requirements exceed supported quantities.",
      );
    }
  }
  async create(actor: AuthenticatedUser, input: CreateOrderInput) {
    requireRole(actor, "CUTTING_SUPERVISOR");
    await this.basis(input.recipeId, input.targetQty);
    const id = await this.orders.create(actor.id, input);
    return this.detail(actor, id);
  }
  private async prepared(
    actor: AuthenticatedUser,
    id: string,
    revision: number,
    state = "CUTTING_IN_PROGRESS",
  ) {
    const order = await this.detail(actor, id);
    if (order.revision !== revision || order.status !== state)
      throw new ConflictError();
    return order;
  }
  async edit(actor: AuthenticatedUser, id: string, input: EditOrderInput) {
    const order = await this.prepared(actor, id, input.expectedRevision);
    if (
      order.firstSubmittedAt &&
      ((input.recipeId !== undefined && input.recipeId !== order.recipe.id) ||
        (input.targetQty !== undefined && input.targetQty !== order.targetQty))
    )
      throw new BusinessRuleError(
        "Recipe and target quantity are frozen after first submission.",
      );
    await this.basis(
      input.recipeId ?? order.recipe.id,
      input.targetQty ?? order.targetQty,
    );
    await this.orders.edit(actor.id, id, input);
    return this.detail(actor, id);
  }
  async submit(actor: AuthenticatedUser, id: string, revision: number) {
    const order = await this.prepared(actor, id, revision);
    if (!order.components.length)
      throw new BusinessRuleError(
        "The complete component manifest is required.",
      );
    await this.orders.submit(actor.id, id, revision);
    return this.detail(actor, id);
  }
  async recut(actor: AuthenticatedUser, id: string, revision: number) {
    await this.prepared(actor, id, revision, "REJECTED");
    await this.orders.recut(actor.id, id, revision);
    return this.detail(actor, id);
  }
}
