import {
  Check,
  CircleAlert,
  Clock3,
  LockKeyhole,
  Plus,
  Scissors,
  ClipboardCheck,
  Layers,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  ArrowRightLeft,
} from "lucide-react";
import { roleLabels, type AppRole } from "@/modules/identity/types";
const states = {
  CUTTING_IN_PROGRESS: {
    label: "Cutting in progress",
    tone: "blue",
    icon: Scissors,
  },
  PENDING_VERIFICATION: {
    label: "Waiting for QC",
    tone: "indigo",
    icon: Clock3,
  },
  VERIFIED: { label: "Verified", tone: "green", icon: Check },
  APPROVED: { label: "Approved", tone: "green", icon: Check },
  REJECTED: { label: "Rejected", tone: "red", icon: CircleAlert },
  READY: { label: "Ready", tone: "teal", icon: Layers },
  STARTED: { label: "Assembly started", tone: "complete", icon: Check },
  ACTIVE: { label: "Active", tone: "green", icon: UserRoundCheck },
  INACTIVE: { label: "Inactive", tone: "neutral", icon: UserRoundX },
  PROTECTED: {
    label: "Protected administrator",
    tone: "neutral",
    icon: LockKeyhole,
  },
  USER_CREATED: { label: "User created", tone: "blue", icon: Plus },
  USER_ROLE_CHANGED: {
    label: "Role changed",
    tone: "indigo",
    icon: ArrowRightLeft,
  },
  USER_ACTIVATED: { label: "Activated", tone: "green", icon: UserRoundCheck },
  USER_DEACTIVATED: { label: "Deactivated", tone: "red", icon: UserRoundX },
} as const;
export type DisplayStatus = keyof typeof states;
export function statusLabel(status: DisplayStatus) {
  return states[status].label;
}
export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { label, tone, icon: Icon } = states[status];
  return (
    <span className={`status-badge tone-${tone}`}>
      <Icon size={16} aria-hidden="true" />
      {label}
    </span>
  );
}
export const roleIcons = {
  CUTTING_SUPERVISOR: Scissors,
  CUTTING_VERIFIER: ClipboardCheck,
  SEWING_SUPERVISOR: Layers,
  SYSTEM_ADMIN: ShieldCheck,
};
export function RoleIcon({
  role,
  size = 16,
}: {
  role: AppRole;
  size?: number;
}) {
  const Icon = roleIcons[role];
  return <Icon size={size} aria-hidden="true" />;
}
export function RoleBadge({ role }: { role: AppRole }) {
  return (
    <span className="role-badge" data-role={role}>
      <RoleIcon role={role} />
      {roleLabels[role]}
    </span>
  );
}
export function FrozenIndicator() {
  return (
    <span className="frozen-indicator">
      <LockKeyhole size={16} aria-hidden="true" />
      Requirements locked after submission
    </span>
  );
}
