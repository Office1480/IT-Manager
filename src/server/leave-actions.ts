"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { countLeaveDays } from "@/lib/leave";
import { requireContext, teamEmployeeIds, type AppContext } from "./context";
import { audit } from "./audit";
import { bool, date, dec, int, str } from "./form";
import { holidays } from "./leave";
import type { ActionResult } from "./action-result";

const refresh = () => revalidatePath("/[locale]/(app)", "layout");

async function canActFor(ctx: AppContext, employeeId: string) {
  if (employeeId === ctx.employeeId) return true;
  if (ctx.can("leave.configure")) return true; // RH / admin
  if (ctx.role === "MANAGER") return (await teamEmployeeIds(ctx)).includes(employeeId);
  return false;
}

export async function previewLeaveDaysAction(startIso: string, endIso: string, startHalf: boolean, endHalf: boolean) {
  const ctx = await requireContext();
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const hol = await holidays(ctx.orgId, start, end);
  return countLeaveDays(start, end, { workDays: ctx.org.workDays, holidays: hol, startHalf, endHalf });
}

export async function createLeaveRequestAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  const t = await getTranslations("leave");
  const employeeId = str(fd, "employeeId") ?? ctx.employeeId;
  if (!employeeId || !(await canActFor(ctx, employeeId))) return { ok: false, error: "forbidden" };
  const type = await db.leaveType.findFirst({ where: { id: str(fd, "leaveTypeId") ?? "", organizationId: ctx.orgId, active: true } });
  const start = date(fd, "startDate");
  const end = date(fd, "endDate") ?? start;
  if (!type || !start || !end) return { ok: false, error: "validation", fieldErrors: { startDate: t("errors.dates") } };
  if (end < start) return { ok: false, error: "validation", fieldErrors: { endDate: t("errors.endBeforeStart") } };
  const startHalf = bool(fd, "startHalf");
  const endHalf = bool(fd, "endHalf");
  const hol = await holidays(ctx.orgId, start, end);
  const days = countLeaveDays(start, end, { workDays: ctx.org.workDays, holidays: hol, startHalf, endHalf });
  if (days <= 0) return { ok: false, error: "validation", fieldErrors: { endDate: t("errors.noWorkingDays") } };

  const overlap = await db.leaveRequest.findFirst({
    where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: end }, endDate: { gte: start } },
  });
  if (overlap) return { ok: false, error: "validation", fieldErrors: { startDate: t("errors.overlap") } };

  // Auto-approbation : type sans validation, ou saisie directe par les RH pour quelqu'un d'autre.
  const autoApprove = !type.requiresApproval || (ctx.can("leave.configure") && employeeId !== ctx.employeeId);
  const req = await db.leaveRequest.create({
    data: {
      organizationId: ctx.orgId,
      employeeId,
      leaveTypeId: type.id,
      startDate: start,
      endDate: end,
      startHalf,
      endHalf,
      days,
      reason: str(fd, "reason"),
      status: autoApprove ? "APPROVED" : "PENDING",
      ...(autoApprove ? { reviewerId: ctx.userId, reviewerName: ctx.user.name, reviewedAt: new Date() } : {}),
    },
  });
  await audit(ctx, "leave.request", "leave", req.id, { type: type.code, days });
  refresh();
  return { ok: true };
}

export async function reviewLeaveAction(id: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<ActionResult> {
  const ctx = await requireContext("leave.approve");
  const req = await db.leaveRequest.findFirst({ where: { id, organizationId: ctx.orgId, status: "PENDING" } });
  if (!req) return { ok: false, error: "notFound" };
  if (req.employeeId === ctx.employeeId && ctx.role !== "OWNER") return { ok: false, error: "forbidden" };
  if (ctx.role === "MANAGER" && !(await teamEmployeeIds(ctx)).includes(req.employeeId)) return { ok: false, error: "forbidden" };
  await db.leaveRequest.update({ where: { id }, data: { status: decision, reviewerId: ctx.userId, reviewerName: ctx.user.name, reviewedAt: new Date(), reviewNote: note || null } });
  await audit(ctx, decision === "APPROVED" ? "leave.approve" : "leave.reject", "leave", id);
  refresh();
  return { ok: true };
}

export async function cancelLeaveAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext();
  const req = await db.leaveRequest.findFirst({ where: { id, organizationId: ctx.orgId, status: { in: ["PENDING", "APPROVED"] } } });
  if (!req) return { ok: false, error: "notFound" };
  const own = req.employeeId === ctx.employeeId;
  if (!(own && req.status === "PENDING") && !ctx.can("leave.configure")) return { ok: false, error: "forbidden" };
  await db.leaveRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(ctx, "leave.cancel", "leave", id);
  refresh();
  return { ok: true };
}

export async function adjustBalanceAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext("leave.configure");
  const employeeId = str(fd, "employeeId");
  const leaveTypeId = str(fd, "leaveTypeId");
  const days = dec(fd, "days");
  const reason = str(fd, "reason");
  if (!employeeId || !leaveTypeId || days == null || !reason) return { ok: false, error: "validation" };
  await db.leaveAdjustment.create({ data: { organizationId: ctx.orgId, employeeId, leaveTypeId, days, reason, effectiveDate: new Date(), createdById: ctx.userId } });
  await audit(ctx, "leave.adjust", "employee", employeeId, { days, reason });
  refresh();
  return { ok: true };
}

// ── Avances sur salaire ──────────────────────────────────────

export async function createAdvanceAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  const employeeId = str(fd, "employeeId") ?? ctx.employeeId;
  if (!employeeId || (employeeId !== ctx.employeeId && !ctx.can("advance.approve"))) return { ok: false, error: "forbidden" };
  const amount = dec(fd, "amount");
  const installments = Math.min(24, Math.max(1, int(fd, "installments") ?? 1));
  const month = str(fd, "firstDeduction");
  const t = await getTranslations("common");
  if (!amount || amount <= 0) return { ok: false, error: "validation", fieldErrors: { amount: t("required") } };
  const first = month ? new Date(`${month}-01T00:00:00Z`) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));
  const adv = await db.salaryAdvance.create({
    data: { organizationId: ctx.orgId, employeeId, amount, currency: ctx.org.currency, installments, firstDeduction: first, reason: str(fd, "reason") },
  });
  await audit(ctx, "advance.request", "advance", adv.id, { amount });
  refresh();
  return { ok: true };
}

export async function reviewAdvanceAction(id: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<ActionResult> {
  const ctx = await requireContext("advance.approve");
  const adv = await db.salaryAdvance.findFirst({ where: { id, organizationId: ctx.orgId, status: "PENDING" } });
  if (!adv) return { ok: false, error: "notFound" };
  await db.salaryAdvance.update({ where: { id }, data: { status: decision, reviewerId: ctx.userId, reviewerName: ctx.user.name, reviewedAt: new Date(), reviewNote: note || null } });
  await audit(ctx, decision === "APPROVED" ? "advance.approve" : "advance.reject", "advance", id);
  refresh();
  return { ok: true };
}

export async function markAdvancePaidAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("advance.approve");
  const res = await db.salaryAdvance.updateMany({ where: { id, organizationId: ctx.orgId, status: "APPROVED", paidAt: null }, data: { paidAt: new Date() } });
  if (!res.count) return { ok: false, error: "notFound" };
  await audit(ctx, "advance.paid", "advance", id);
  refresh();
  return { ok: true };
}

export async function cancelAdvanceAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext();
  const adv = await db.salaryAdvance.findFirst({ where: { id, organizationId: ctx.orgId, status: "PENDING" } });
  if (!adv || (adv.employeeId !== ctx.employeeId && !ctx.can("advance.approve"))) return { ok: false, error: "forbidden" };
  await db.salaryAdvance.update({ where: { id }, data: { status: "CANCELLED" } });
  refresh();
  return { ok: true };
}
