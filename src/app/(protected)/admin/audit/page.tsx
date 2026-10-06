import { getPageUser } from "@/server/auth/context";
import { AuditPanel } from "@/components/admin/audit-panel";
export default async function AuditPage() {
  await getPageUser("SYSTEM_ADMIN");
  return <AuditPanel />;
}
