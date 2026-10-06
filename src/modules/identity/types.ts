export const roles = [
  "SYSTEM_ADMIN",
  "CUTTING_SUPERVISOR",
  "CUTTING_VERIFIER",
  "SEWING_SUPERVISOR",
] as const;
export type AppRole = (typeof roles)[number];
export const productionRoles = [
  "CUTTING_SUPERVISOR",
  "CUTTING_VERIFIER",
  "SEWING_SUPERVISOR",
] as const;
export type ProductionRole = (typeof productionRoles)[number];
export const roleLabels: Record<AppRole, string> = {
  SYSTEM_ADMIN: "System Admin",
  CUTTING_SUPERVISOR: "Cutting Supervisor",
  CUTTING_VERIFIER: "Cutting Verifier",
  SEWING_SUPERVISOR: "Sewing Supervisor",
};
export const rolePaths: Record<AppRole, string> = {
  SYSTEM_ADMIN: "/admin",
  CUTTING_SUPERVISOR: "/supervisor",
  CUTTING_VERIFIER: "/verifier",
  SEWING_SUPERVISOR: "/sewing",
};
export interface AuthIdentity {
  id: string;
  email: string;
}
export interface AuthenticatedUser extends AuthIdentity {
  fullName: string;
  role: AppRole;
  isActive: boolean;
}
export interface ApplicationProfile {
  id: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
}
export const demoPersonas = [
  {
    id: "cutting-supervisor",
    role: "CUTTING_SUPERVISOR",
    label: "Cutting Supervisor",
    env: "DEMO_CUTTING_SUPERVISOR",
  },
  {
    id: "cutting-verifier",
    role: "CUTTING_VERIFIER",
    label: "Cutting Verifier",
    env: "DEMO_CUTTING_VERIFIER",
  },
  {
    id: "sewing-supervisor",
    role: "SEWING_SUPERVISOR",
    label: "Sewing Supervisor",
    env: "DEMO_SEWING_SUPERVISOR",
  },
] as const;
export type DemoPersona = (typeof demoPersonas)[number]["id"];
