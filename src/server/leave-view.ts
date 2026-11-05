import "server-only";
import { db } from "@/lib/db";
import { lname } from "@/lib/i18n-json";
import type { AppContext } from "./context";
import { balancesFor, coverageConflicts, leaveTypes, pendingForApprover } from "./leave";
import type { LeaveTypeOption } from "@/components/leave/leave-request-dialog";
import type { ApprovalRow } from "@/components/leave/approvals";
import type { RequestRow } from "@/components/leave/requests-list";
import type { BalanceView } from "@/components/leave/balance-cards";

export async function typeOptions(ctx: AppContext, locale: string): Promise<LeaveTypeOption[]> {
  return (await leaveTypes(ctx)).map((t) => ({
    id: t.id,
    code: t.code,
    name: lname(t.names, locale),
    color: t.color,
    requiresDocument: t.requiresDocument,
    balanceCode: t.tracksBalance ? t.code : t.deductsFromCode,
  }));
}

export async function balanceViews(ctx: AppContext, employeeId: string, locale: string): Promise<BalanceView[]> {
  return (await balancesFor(ctx, employeeId)).map((b) => ({
    code: b.type.code, name: lname(b.type.names, locale), color: b.type.color,
    accrued: b.accrued, taken: b.taken, pending: b.pending, adjust: b.adjust, available: b.available,
  }));
}

export async function approvalRows(ctx: AppContext, locale: string): Promise<ApprovalRow[]> {
  const list = await pendingForApprover(ctx);
  return Promise.all(
    list.map(async (r) => ({
      id: r.id,
      employee: r.employee,
      typeName: lname(r.leaveType.names, locale),
      color: r.leaveType.color,
      startDate: r.startDate,
      endDate: r.endDate,
      days: Number(r.days),
      reason: r.reason,
      createdAt: r.createdAt,
      conflicts: (await coverageConflicts(ctx, r.employee.id, r.startDate, r.endDate)).map((c) => ({
        projectName: c.projectName, reason: c.reason, otherName: c.other ? `${c.other.firstName} ${c.other.lastName}` : null, criticality: c.criticality,
      })),
    })),
  );
}

export async function requestRows(ctx: AppContext, employeeId: string, locale: string): Promise<RequestRow[]> {
  const rows = await db.leaveRequest.findMany({ where: { organizationId: ctx.orgId, employeeId }, include: { leaveType: true }, orderBy: { startDate: "desc" }, take: 50 });
  return rows.map((r) => ({
    id: r.id, typeName: lname(r.leaveType.names, locale), color: r.leaveType.color, startDate: r.startDate, endDate: r.endDate, days: Number(r.days),
    status: r.status, reviewerName: r.reviewerName, reviewNote: r.reviewNote, createdAt: r.createdAt,
    canCancel: (r.status === "PENDING" && r.employeeId === ctx.employeeId) || (ctx.can("leave.configure") && (r.status === "PENDING" || r.status === "APPROVED")),
  }));
}
