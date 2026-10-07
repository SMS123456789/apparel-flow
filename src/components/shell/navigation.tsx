"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { rolePaths, roleLabels, type AppRole } from "@/modules/identity/types";
import { Users, History } from "lucide-react";
import { roleIcons } from "@/components/shared/semantic-status";
export function ShellNavigation({ role }: { role: AppRole }) {
  const path = usePathname();
  const links =
    role === "SYSTEM_ADMIN"
      ? [
          { href: "/admin", label: "Users", icon: Users },
          {
            href: "/admin/audit",
            label: "Administrative audit",
            icon: History,
          },
        ]
      : [
          {
            href: rolePaths[role],
            label:
              role === "CUTTING_SUPERVISOR"
                ? "Cutting orders"
                : role === "CUTTING_VERIFIER"
                  ? "Verification queue"
                  : "Sewing queue",
            icon: roleIcons[role],
          },
        ];
  return (
    <nav aria-label="Workspace">
      <p className="sidebar-label">{roleLabels[role]}</p>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={
            path === link.href ||
            (role !== "SYSTEM_ADMIN" && path.startsWith(`${link.href}/`))
              ? "page"
              : undefined
          }
        >
          <link.icon size={16} aria-hidden="true" />
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
