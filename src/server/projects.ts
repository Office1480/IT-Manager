import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { AppContext } from "./context";

const person = { select: { id: true, firstName: true, lastName: true, jobTitle: true } } as const;

export async function listProjects(ctx: AppContext) {
  return db.project.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: [{ name: "asc" }],
    include: { owner: person, deputy: person, backlog: { select: { stage: true } } },
  });
}

export async function getProject(ctx: AppContext, id: string) {
  const p = await db.project.findFirst({
    where: { id, organizationId: ctx.orgId },
    include: {
      owner: person,
      deputy: person,
      backlog: {
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        include: { author: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { comments: true } } },
      },
    },
  });
  if (!p) notFound();
  return p;
}

export function canManageProject(ctx: AppContext, p: { ownerId: string | null; deputyId: string | null }) {
  return ctx.can("project.write") || (!!ctx.employeeId && (p.ownerId === ctx.employeeId || p.deputyId === ctx.employeeId));
}

export const riceScore = (i: { reach: number | null; impact: unknown; confidence: number | null; effort: unknown }) => {
  const effort = Number(i.effort ?? 0);
  if (!i.reach || i.impact == null || i.confidence == null || !effort) return null;
  return Math.round((i.reach * Number(i.impact) * (i.confidence / 100)) / effort);
};

/** Risques de continuité à l'échelle de l'organisation. */
export async function continuityRisks(ctx: AppContext, horizonDays = 60) {
  const projects = await listProjects(ctx);
  const now = new Date();
  const horizon = new Date(now.getTime() + horizonDays * 86_400_000);
  const leaves = await db.leaveRequest.findMany({
    where: { organizationId: ctx.orgId, status: { in: ["APPROVED", "PENDING"] }, endDate: { gte: now }, startDate: { lte: horizon } },
    select: { employeeId: true, startDate: true, endDate: true },
  });
  const risks: { kind: "noDeputy" | "overloaded" | "lowDeputy" | "coverageGap"; projectId?: string; projectName?: string; employeeId?: string; data: Record<string, string | number> }[] = [];
  for (const p of projects) {
    if (p.status === "SUNSET") continue;
    if (!p.deputy) risks.push({ kind: "noDeputy", projectId: p.id, projectName: p.name, data: {} });
    else if (p.deputyExpertise <= 2 && (p.criticality === "HIGH" || p.criticality === "CRITICAL"))
      risks.push({ kind: "lowDeputy", projectId: p.id, projectName: p.name, data: { level: p.deputyExpertise, crit: p.criticality } });
    if (p.owner && p.deputy) {
      const lo = leaves.filter((l) => l.employeeId === p.owner!.id);
      const ld = leaves.filter((l) => l.employeeId === p.deputy!.id);
      for (const a of lo)
        for (const b of ld)
          if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
            const from = a.startDate > b.startDate ? a.startDate : b.startDate;
            risks.push({ kind: "coverageGap", projectId: p.id, projectName: p.name, data: { owner: `${p.owner.firstName} ${p.owner.lastName}`, deputy: `${p.deputy.firstName} ${p.deputy.lastName}`, date: from.toISOString().slice(0, 10) } });
          }
    }
  }
  const ownerCount = new Map<string, { n: number; name: string }>();
  for (const p of projects) if (p.owner && p.status !== "SUNSET") {
    const c = ownerCount.get(p.owner.id) ?? { n: 0, name: `${p.owner.firstName} ${p.owner.lastName}` };
    c.n++;
    ownerCount.set(p.owner.id, c);
  }
  for (const [id, c] of ownerCount) if (c.n >= 3) risks.push({ kind: "overloaded", employeeId: id, data: { count: c.n, name: c.name } });
  return risks;
}

export async function listBacklog(ctx: AppContext, projectId?: string) {
  return db.backlogItem.findMany({
    where: { organizationId: ctx.orgId, ...(projectId ? { projectId } : {}) },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      project: { select: { id: true, name: true, key: true, color: true, ownerId: true, deputyId: true } },
      _count: { select: { comments: true } },
    },
  });
}

export async function getBacklogItem(ctx: AppContext, id: string) {
  return db.backlogItem.findFirst({
    where: { id, organizationId: ctx.orgId },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      project: { select: { id: true, name: true, key: true, ownerId: true, deputyId: true, jiraProjectKey: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
}
