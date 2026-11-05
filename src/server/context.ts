import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { can, type Permission } from "@/lib/rbac";

export type AppContext = NonNullable<Awaited<ReturnType<typeof loadContext>>>;

const loadContext = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: session.uid, organizationId: session.oid } },
    include: { user: true, organization: true, employee: true },
  });
  if (!membership) return null;
  return {
    userId: membership.userId,
    orgId: membership.organizationId,
    org: membership.organization,
    user: membership.user,
    role: membership.role,
    employeeId: membership.employeeId,
    employee: membership.employee,
    can: (p: Permission) => can(membership.role, p),
  };
});

export async function getContext() {
  return loadContext();
}

/** Contexte obligatoire : redirige vers la connexion sinon. */
export async function requireContext(permission?: Permission) {
  const ctx = await loadContext();
  if (!ctx) redirect("/login");
  if (permission && !ctx.can(permission)) throw new ForbiddenError(permission);
  return ctx;
}

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Permission refusée : ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** IDs des collaborateurs qu'un manager peut voir (ses N-1 récursifs). */
export async function teamEmployeeIds(ctx: AppContext): Promise<string[]> {
  if (!ctx.employeeId) return [];
  const all = await db.employee.findMany({
    where: { organizationId: ctx.orgId, deletedAt: null },
    select: { id: true, managerId: true },
  });
  const result = new Set<string>();
  const walk = (id: string) => {
    for (const e of all) if (e.managerId === id && !result.has(e.id)) { result.add(e.id); walk(e.id); }
  };
  walk(ctx.employeeId);
  return [...result];
}
