import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptText } from "@/lib/crypto";
import type { AppContext } from "./context";

export type EmployeeFilters = { q?: string; status?: string; department?: string };

export async function listEmployees(ctx: AppContext, f: EmployeeFilters = {}) {
  const where: Prisma.EmployeeWhereInput = { organizationId: ctx.orgId, deletedAt: null };
  if (f.status && f.status !== "all") where.status = f.status as Prisma.EmployeeWhereInput["status"];
  else where.status = { not: "OFFBOARDED" };
  if (f.department) where.departmentId = f.department;
  if (f.q) {
    const q = f.q.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { firstNameHe: { contains: q } },
      { lastNameHe: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      { jobTitle: { contains: q, mode: "insensitive" } },
      { employeeNumber: { contains: q, mode: "insensitive" } },
    ];
  }
  return db.employee.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      jobTitle: true,
      status: true,
      startDate: true,
      contractType: true,
      department: { select: { id: true, name: true, color: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getEmployee(ctx: AppContext, id: string) {
  const e = await db.employee.findFirst({
    where: { id, organizationId: ctx.orgId, deletedAt: null },
    include: {
      department: true,
      manager: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
      reports: { where: { deletedAt: null }, select: { id: true, firstName: true, lastName: true, jobTitle: true }, orderBy: { lastName: "asc" } },
      membership: { select: { role: true, user: { select: { email: true, lastLoginAt: true } } } },
    },
  });
  if (!e) notFound();
  const self = ctx.employeeId === e.id;
  const sensitive = ctx.can("employee.sensitive.read") || self;
  return {
    ...e,
    self,
    sensitiveVisible: sensitive,
    nationalId: sensitive ? decryptText(e.nationalIdEnc) : null,
    passport: sensitive ? decryptText(e.passportEnc) : null,
    bankAccount: sensitive ? decryptText(e.bankAccountEnc) : null,
    nationalIdEnc: undefined,
    passportEnc: undefined,
    bankAccountEnc: undefined,
  };
}

export type EmployeeDetail = Awaited<ReturnType<typeof getEmployee>>;

export async function employeeOptions(ctx: AppContext) {
  return db.employee.findMany({
    where: { organizationId: ctx.orgId, deletedAt: null, status: { not: "OFFBOARDED" } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export async function departmentOptions(ctx: AppContext) {
  return db.department.findMany({ where: { organizationId: ctx.orgId }, orderBy: { name: "asc" } });
}

export async function nextEmployeeNumber(orgId: string) {
  const rows = await db.employee.findMany({ where: { organizationId: orgId }, select: { employeeNumber: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number.parseInt(r.employeeNumber.replace(/\D/g, ""), 10) || 0), 0);
  return String(max + 1).padStart(4, "0");
}

export async function canSeeDocuments(ctx: AppContext, employeeId: string) {
  return ctx.can("document.read.all") || ctx.employeeId === employeeId;
}

export async function listDocuments(ctx: AppContext, filter: { employeeId?: string; assetId?: string }) {
  return db.document.findMany({
    where: { organizationId: ctx.orgId, ...filter },
    orderBy: { createdAt: "desc" },
  });
}

export async function listCompensation(ctx: AppContext, employeeId: string) {
  return db.compensationEvent.findMany({
    where: { organizationId: ctx.orgId, employeeId },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
  });
}
