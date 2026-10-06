import type { AuthenticatedUser } from "@/modules/identity/types";
import type { OrderDetail, Recipe } from "@/modules/orders/types";
export const supervisor: AuthenticatedUser = {
  id: "93000000-0000-4000-8000-000000000001",
  email: "supervisor@unit.test",
  fullName: "Supervisor",
  role: "CUTTING_SUPERVISOR",
  isActive: true,
};
export const verifier: AuthenticatedUser = {
  ...supervisor,
  id: "93000000-0000-4000-8000-000000000002",
  role: "CUTTING_VERIFIER",
  fullName: "Verifier",
};
export const recipe: Recipe = {
  id: "10000000-0000-4000-8000-000000000001",
  code: "REC-BL01",
  name: "Casual Blouse",
  category: "Blouse",
  standardFabricYards: "1.8",
  wastageCapPct: "5",
  components: [
    "Front Body Panel",
    "Back Body Panel",
    "Sleeves (Left & Right)",
    "Collar & Stand",
    "Sleeve Cuffs",
  ].map((name, i) => ({
    id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name,
    piecesPerGarment: i === 2 || i === 4 ? 2 : 1,
    sortOrder: i + 1,
    imageUrl: null,
  })),
};
export const order: OrderDetail = {
  id: "94000000-0000-4000-8000-000000000001",
  orderNo: "AF-000000000001",
  recipeName: recipe.name,
  recipeCode: recipe.code,
  recipe,
  targetQty: 50,
  status: "CUTTING_IN_PROGRESS",
  revision: 0,
  createdAt: "2026-10-06T00:00:00Z",
  updatedAt: "2026-10-06T00:00:00Z",
  fabricRollId: "ROLL",
  actualFabricYards: "94.5",
  expectedFabricYards: "90",
  createdBy: supervisor.id,
  firstSubmittedAt: null,
  currentAttemptId: null,
  approvedLogId: null,
  sewingStartedAt: null,
  startedBy: null,
  components: recipe.components.map((c) => ({
    componentId: c.id,
    name: c.name,
    piecesPerGarment: c.piecesPerGarment,
    expectedQty: 50 * c.piecesPerGarment,
    sortOrder: c.sortOrder,
  })),
  attempts: [],
  evidence: [],
};
