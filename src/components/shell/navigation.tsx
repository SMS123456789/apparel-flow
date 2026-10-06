"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { rolePaths, roleLabels, type AppRole } from "@/modules/identity/types";
export function ShellNavigation({ role }: { role: AppRole }) {
  const path = usePathname();
  const links =
    role === "SYSTEM_ADMIN"
      ? [
          { href: "/admin", label: "Users" },
          { href: "/admin/audit", label: "Administrative audit" },
        ]
      : [{ href: rolePaths[role], label: roleLabels[role] }];
  return (
    <nav aria-label="Workspace">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={path === link.href ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
