import { getPageUser } from "@/server/auth/context";
import { ProductionAuditPanel } from "@/components/admin/production-audit-panel";
export const metadata = { title: "Production audit · ApparelFlow" };
export default async function ProductionAuditPage() {
  await getPageUser("SYSTEM_ADMIN");
  return <ProductionAuditPanel />;
}
