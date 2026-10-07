import type { ReactNode } from "react";
import { getPageUser } from "@/server/auth/context";
import type { AppRole } from "@/modules/identity/types";
import { SignOut } from "@/components/auth/sign-out";
import { Factory } from "lucide-react";
import { RoleBadge } from "@/components/shared/semantic-status";
import { ShellNavigation } from "./navigation";
export async function ProtectedShell({
  role,
  children,
}: {
  role: AppRole;
  children: ReactNode;
}) {
  const user = await getPageUser(role);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header" data-role={user.role}>
        <span className="brand">
          <Factory size={20} aria-hidden="true" />
          ApparelFlow
        </span>
        <div className="signed-in">
          <span>{user.fullName}</span>
          <RoleBadge role={user.role} />
        </div>
        <SignOut />
      </header>
      <div className="app-shell" data-role={user.role}>
        <aside className="sidebar">
          <ShellNavigation role={user.role} />
        </aside>
        <main id="main-content" className="workspace" tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}
