import type { Role } from "@prisma/client";

/**
 * Matrice de permissions. Chaque rôle hérite explicitement de sa liste :
 * pas de magie, facile à auditer.
 */
export const PERMISSIONS = [
  "employee.read.all",
  "employee.read.team",
  "employee.write",
  "employee.sensitive.read",
  "compensation.read",
  "compensation.write",
  "document.read.all",
  "document.write",
  "asset.read",
  "asset.write",
  "leave.read.all",
  "leave.approve",
  "leave.configure",
  "advance.approve",
  "project.read",
  "project.write",
  "backlog.write",
  "audit.read",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS];

const MATRIX: Record<Role, readonly Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  HR: [
    "employee.read.all",
    "employee.read.team",
    "employee.write",
    "employee.sensitive.read",
    "compensation.read",
    "compensation.write",
    "document.read.all",
    "document.write",
    "asset.read",
    "asset.write",
    "leave.read.all",
    "leave.approve",
    "leave.configure",
    "advance.approve",
    "project.read",
    "backlog.write",
    "audit.read",
  ],
  MANAGER: ["employee.read.all", "employee.read.team", "asset.read", "leave.read.all", "leave.approve", "project.read", "project.write", "backlog.write"],
  EMPLOYEE: ["employee.read.all", "project.read", "backlog.write", "leave.read.all"],
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}

export const ROLE_ORDER: Role[] = ["OWNER", "ADMIN", "HR", "MANAGER", "EMPLOYEE"];
