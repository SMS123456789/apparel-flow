import type { ReactNode } from "react";
import { getPageUser } from "@/server/auth/context";
import { roleLabels, type AppRole } from "@/modules/identity/types";
import { SignOut } from "@/components/auth/sign-out";
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
      <header className="app-header">
        <span className="brand">ApparelFlow</span>
        <div className="signed-in">
          <span>{user.fullName}</span>
          <span className="helper">{roleLabels[user.role]}</span>
        </div>
        <SignOut />
      </header>
      <div className="app-shell">
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
