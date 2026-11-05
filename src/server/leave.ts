import "server-only";
import type { LeaveType } from "@prisma/client";
import { db } from "@/lib/db";
import { accruedAnnual, accruedSick, round1 } from "@/lib/leave";
import type { AppContext } from "./context";

export async function leaveTypes(ctx: AppContext, includeInactive = false) {
  return db.leaveType.findMany({ where: { organizationId: ctx.orgId, ...(includeInactive ? {} : { active: true }) }, orderBy: { position: "asc" } });
}

export async function holidays(orgId: string, from?: Date, to?: Date) {
  return db.holiday.findMany({
    where: { organizationId: orgId, ...(from && to ? { date: { gte: from, lte: to } } : {}) },
    orderBy: { date: "asc" },
  });
}

export type Balance = { type: LeaveType; accrued: number; taken: number; pending: number; adjust: number; available: number };

/** Soldes de congés d'un collaborateur à date. */
export async function balancesFor(ctx: AppContext, employeeId: string, asOf = new Date()): Promise<Balance[]> {
  const [emp, types, requests, adjustments] = await Promise.all([
    db.employee.findFirstOrThrow({ where: { id: employeeId, organizationId: ctx.orgId } }),
    leaveTypes(ctx),
    db.leaveRequest.findMany({ where: { employeeId, status: { in: ["APPROVED", "PENDING"] } }, include: { leaveType: true } }),
    db.leaveAdjustment.findMany({ where: { employeeId } }),
  ]);
  const start = emp.seniorityDate ?? emp.startDate ?? emp.createdAt;
  const workDaysPerWeek = ctx.org.workDays.length;
  // Congés annuels : période = année civile (le report de l'année précédente est saisi en ajustement au 1er janvier).
  // Maladie : cumul depuis l'embauche, plafonné à 90 jours par la loi.
  const yearStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
  const periodStart = start > yearStart ? start : yearStart;
  return types
    .filter((t) => t.tracksBalance)
    .map((type) => {
      const yearly = type.code !== "SICK";
      const override = type.accrualPerMonth == null ? null : Number(type.accrualPerMonth);
      const accrued =
        type.code === "SICK"
          ? accruedSick(start, asOf, emp.workPercentage)
          : type.code === "VACATION"
            ? round1(accruedAnnual(start, asOf, emp.workPercentage, workDaysPerWeek, override) - accruedAnnual(start, periodStart, emp.workPercentage, workDaysPerWeek, override))
            : 0;
      const inPeriod = (d: Date) => !yearly || d >= periodStart;
      const consumes = (r: (typeof requests)[number]) => (r.leaveType.code === type.code || r.leaveType.deductsFromCode === type.code) && inPeriod(r.startDate);
      const taken = round1(requests.filter((r) => r.status === "APPROVED" && consumes(r)).reduce((s, r) => s + Number(r.days), 0));
      const pending = round1(requests.filter((r) => r.status === "PENDING" && consumes(r)).reduce((s, r) => s + Number(r.days), 0));
      const adjust = round1(adjustments.filter((a) => a.leaveTypeId === type.id && inPeriod(a.effectiveDate)).reduce((s, a) => s + Number(a.days), 0));
      let available = round1(accrued + adjust - taken);
      if (type.maxBalance != null) available = Math.min(available, Number(type.maxBalance));
      return { type, accrued, taken, pending, adjust, available };
    });
}

/** Demandes (approuvées + en attente) qui chevauchent une période — pour le planning. */
export async function requestsInRange(ctx: AppContext, from: Date, to: Date) {
  return db.leaveRequest.findMany({
    where: { organizationId: ctx.orgId, status: { in: ["APPROVED", "PENDING"] }, startDate: { lte: to }, endDate: { gte: from } },
    include: { leaveType: true },
  });
}

export async function pendingForApprover(ctx: AppContext) {
  if (!ctx.can("leave.approve")) return [];
  const where = { organizationId: ctx.orgId, status: "PENDING" as const };
  const list = await db.leaveRequest.findMany({
    where,
    orderBy: { startDate: "asc" },
    include: { leaveType: true, employee: { select: { id: true, firstName: true, lastName: true, managerId: true, jobTitle: true } } },
  });
  // Un manager ne voit que les demandes de son équipe (les RH/admins voient tout).
  if (ctx.role === "MANAGER") {
    const { teamEmployeeIds } = await import("./context");
    const team = new Set(await teamEmployeeIds(ctx));
    return list.filter((r) => team.has(r.employee.id));
  }
  return list.filter((r) => r.employee.id !== ctx.employeeId || ctx.role === "OWNER");
}

/**
 * Risque « bus factor » : pour chaque projet dont le collaborateur est owner/suppléant,
 * l'autre responsable est-il aussi absent sur la période ?
 */
export async function coverageConflicts(ctx: AppContext, employeeId: string, from: Date, to: Date) {
  const projects = await db.project.findMany({
    where: { organizationId: ctx.orgId, OR: [{ ownerId: employeeId }, { deputyId: employeeId }] },
    include: { owner: { select: { id: true, firstName: true, lastName: true } }, deputy: { select: { id: true, firstName: true, lastName: true } } },
  });
  const conflicts: { projectId: string; projectName: string; criticality: string; other: { id: string; firstName: string; lastName: string } | null; reason: "noBackup" | "bothAway" }[] = [];
  for (const p of projects) {
    const other = p.ownerId === employeeId ? p.deputy : p.owner;
    if (!other) {
      conflicts.push({ projectId: p.id, projectName: p.name, criticality: p.criticality, other: null, reason: "noBackup" });
      continue;
    }
    const overlap = await db.leaveRequest.findFirst({
      where: { employeeId: other.id, status: { in: ["APPROVED", "PENDING"] }, startDate: { lte: to }, endDate: { gte: from } },
    });
    if (overlap) conflicts.push({ projectId: p.id, projectName: p.name, criticality: p.criticality, other, reason: "bothAway" });
  }
  return conflicts;
}

export async function listAdvances(ctx: AppContext) {
  const mine = !ctx.can("advance.approve");
  return db.salaryAdvance.findMany({
    where: { organizationId: ctx.orgId, ...(mine ? { employeeId: ctx.employeeId ?? "__none" } : {}) },
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
  });
}
