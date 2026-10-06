import type { AuthenticatedUser } from "@/modules/identity/types";
export interface AdminUser extends AuthenticatedUser {
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface AdminAuditEvent {
  id: string;
  actorId: string;
  actorName: string;
  targetUserId: string;
  targetName: string;
  action:
    | "USER_CREATED"
    | "USER_ROLE_CHANGED"
    | "USER_ACTIVATED"
    | "USER_DEACTIVATED";
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  requestId: string;
  createdAt: string;
}
export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}
