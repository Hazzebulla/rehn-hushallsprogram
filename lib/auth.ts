import { roleMatrix, type FoundationRole } from "./foundation";

export type SessionUser = {
  id: string;
  companyId: string;
  role: FoundationRole;
  email: string;
};

export function can(user: SessionUser, permission: string) {
  return roleMatrix[user.role].includes(permission);
}

export function requireTenant(user: SessionUser, companyId: string) {
  if (user.companyId !== companyId) {
    throw new Error("Åtkomst nekad: fel organisation.");
  }
}

export function requirePermission(user: SessionUser, permission: string) {
  if (!can(user, permission)) {
    throw new Error(`Åtkomst nekad: saknar ${permission}.`);
  }
}

export function assertScopedAccess(user: SessionUser, companyId: string, permission: string) {
  requireTenant(user, companyId);
  requirePermission(user, permission);
}
