import type { ReactNode } from "react";
import { ProtectedShell } from "@/components/shell/protected-shell";
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: ReactNode }) {
  return <ProtectedShell role="CUTTING_VERIFIER">{children}</ProtectedShell>;
}
