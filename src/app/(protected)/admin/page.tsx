import { getPageUser } from "@/server/auth/context";
import { UsersPanel } from "@/components/admin/users-panel";
export default async function AdminPage() {
  await getPageUser("SYSTEM_ADMIN");
  return <UsersPanel />;
}
