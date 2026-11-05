"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { encryptText } from "@/lib/crypto";
import { isValidTeudatZehut } from "@/lib/utils";
import { requireContext } from "./context";
import { audit } from "./audit";
import { bool, date, dec, int, oneOf, reqStr, str } from "./form";
import { nextEmployeeNumber } from "./employees";
import { ensureChecklist } from "./checklists";
import type { ActionResult } from "./action-result";

const STATUSES = ["ONBOARDING", "ACTIVE", "OFFBOARDING", "OFFBOARDED"] as const;
const CONTRACTS = ["PERMANENT", "FIXED_TERM", "FREELANCE", "INTERN"] as const;
const GENDERS = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const;
const MARITAL = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "PARTNERSHIP"] as const;

function readEmployee(fd: FormData) {
  return {
    employeeNumber: str(fd, "employeeNumber"),
    status: oneOf(fd, "status", STATUSES, "ACTIVE"),
    firstName: reqStr(fd, "firstName"),
    lastName: reqStr(fd, "lastName"),
    firstNameHe: str(fd, "firstNameHe"),
    lastNameHe: str(fd, "lastNameHe"),
    birthDate: date(fd, "birthDate"),
    gender: oneOf(fd, "gender", GENDERS),
    nationality: str(fd, "nationality"),
    maritalStatus: oneOf(fd, "maritalStatus", MARITAL),
    childrenCount: int(fd, "childrenCount"),
    email: reqStr(fd, "email").toLowerCase(),
    personalEmail: str(fd, "personalEmail"),
    phone: str(fd, "phone"),
    addressStreet: str(fd, "addressStreet"),
    addressCity: str(fd, "addressCity"),
    addressZip: str(fd, "addressZip"),
    addressCountry: str(fd, "addressCountry"),
    emergencyName: str(fd, "emergencyName"),
    emergencyPhone: str(fd, "emergencyPhone"),
    emergencyRelation: str(fd, "emergencyRelation"),
    jobTitle: str(fd, "jobTitle"),
    departmentId: str(fd, "departmentId"),
    managerId: str(fd, "managerId"),
    startDate: date(fd, "startDate"),
    endDate: date(fd, "endDate"),
    seniorityDate: date(fd, "seniorityDate"),
    contractType: oneOf(fd, "contractType", CONTRACTS, "PERMANENT"),
    workPercentage: Math.min(100, Math.max(1, int(fd, "workPercentage") ?? 100)),
    workLocation: str(fd, "workLocation"),
    bankName: str(fd, "bankName"),
    bankBranch: str(fd, "bankBranch"),
    pensionFund: str(fd, "pensionFund"),
    pensionEmployeeRate: dec(fd, "pensionEmployeeRate"),
    pensionEmployerRate: dec(fd, "pensionEmployerRate"),
    severanceRate: dec(fd, "severanceRate"),
    kerenHishtalmut: bool(fd, "kerenHishtalmut"),
    kerenEmployeeRate: dec(fd, "kerenEmployeeRate"),
    kerenEmployerRate: dec(fd, "kerenEmployerRate"),
    notes: str(fd, "notes"),
  };
}

async function validate(orgId: string, data: ReturnType<typeof readEmployee>, nationalId: string | null, excludeId?: string) {
  const t = await getTranslations();
  const errors: Record<string, string> = {};
  if (!data.firstName) errors.firstName = t("common.required");
  if (!data.lastName) errors.lastName = t("common.required");
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = t("common.required");
  if (nationalId && !isValidTeudatZehut(nationalId)) errors.nationalId = t("people.invalidTz");
  if (data.email) {
    const dup = await db.employee.findFirst({ where: { organizationId: orgId, email: data.email, deletedAt: null, id: excludeId ? { not: excludeId } : undefined } });
    if (dup) errors.email = t("people.emailTaken");
  }
  if (data.employeeNumber) {
    const dup = await db.employee.findFirst({ where: { organizationId: orgId, employeeNumber: data.employeeNumber, id: excludeId ? { not: excludeId } : undefined } });
    if (dup) errors.employeeNumber = t("people.numberTaken");
  }
  if (data.managerId && data.managerId === excludeId) errors.managerId = t("common.error");
  return errors;
}

/** Résout « nouveau département » saisi à la volée dans le formulaire. */
async function resolveDepartment(orgId: string, fd: FormData) {
  if (fd.get("departmentId") !== "__new") return;
  const name = str(fd, "newDepartment");
  if (!name) return fd.set("departmentId", "");
  const dep = await db.department.upsert({
    where: { organizationId_name: { organizationId: orgId, name } },
    create: { organizationId: orgId, name },
    update: {},
  });
  fd.set("departmentId", dep.id);
}

export async function createEmployeeAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireContext("employee.write");
  await resolveDepartment(ctx.orgId, fd);
  const data = readEmployee(fd);
  const nationalId = str(fd, "nationalId");
  const errors = await validate(ctx.orgId, data, nationalId);
  if (Object.keys(errors).length) return { ok: false, error: "validation", fieldErrors: errors };

  const employee = await db.employee.create({
    data: {
      ...data,
      employeeNumber: data.employeeNumber ?? (await nextEmployeeNumber(ctx.orgId)),
      organizationId: ctx.orgId,
      nationalIdEnc: encryptText(nationalId),
      nationalIdLast4: nationalId ? nationalId.slice(-4) : null,
      passportEnc: encryptText(str(fd, "passport")),
      bankAccountEnc: encryptText(str(fd, "bankAccount")),
    },
  });
  await audit(ctx, "employee.create", "employee", employee.id, { name: `${employee.firstName} ${employee.lastName}` });
  await autoChecklist(ctx.orgId, employee.id, employee.status);
  revalidatePath("/[locale]/(app)", "layout");
  return { ok: true, data: { id: employee.id } };
}

export async function updateEmployeeAction(id: string, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireContext("employee.write");
  const existing = await db.employee.findFirst({ where: { id, organizationId: ctx.orgId, deletedAt: null } });
  if (!existing) return { ok: false, error: "notFound" };
  await resolveDepartment(ctx.orgId, fd);
  const data = readEmployee(fd);
  const nationalId = str(fd, "nationalId");
  const errors = await validate(ctx.orgId, data, nationalId, id);
  if (Object.keys(errors).length) return { ok: false, error: "validation", fieldErrors: errors };

  // Les champs chiffrés ne sont réécrits que s'ils sont soumis (champ présent).
  const encrypted: Prisma.EmployeeUpdateInput = {};
  if (fd.has("nationalId")) {
    encrypted.nationalIdEnc = encryptText(nationalId);
    encrypted.nationalIdLast4 = nationalId ? nationalId.slice(-4) : null;
  }
  if (fd.has("passport")) encrypted.passportEnc = encryptText(str(fd, "passport"));
  if (fd.has("bankAccount")) encrypted.bankAccountEnc = encryptText(str(fd, "bankAccount"));

  const { departmentId, managerId, employeeNumber, ...rest } = data;
  const changed = Object.entries(data)
    .filter(([k, v]) => String((existing as Record<string, unknown>)[k] ?? "") !== String(v ?? ""))
    .map(([k]) => k);

  await db.employee.update({
    where: { id },
    data: {
      ...rest,
      ...encrypted,
      employeeNumber: employeeNumber ?? existing.employeeNumber,
      department: departmentId ? { connect: { id: departmentId } } : { disconnect: true },
      manager: managerId ? { connect: { id: managerId } } : { disconnect: true },
    },
  });
  await audit(ctx, "employee.update", "employee", id, { fields: changed });
  if (data.status !== existing.status) await autoChecklist(ctx.orgId, id, data.status);
  revalidatePath("/[locale]/(app)", "layout");
  return { ok: true, data: { id } };
}

/** Génère automatiquement la checklist quand un collaborateur entre en intégration ou en départ. */
async function autoChecklist(orgId: string, employeeId: string, status: string) {
  if (status !== "ONBOARDING" && status !== "OFFBOARDING") return;
  const t = await getTranslations("checklist");
  await ensureChecklist(orgId, employeeId, status, { returnAsset: (name) => t("returnAsset", { name }), revokeLicense: (name) => t("revokeLicense", { name }) });
}

export async function archiveEmployeeAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("employee.write");
  const res = await db.employee.updateMany({
    where: { id, organizationId: ctx.orgId },
    data: { deletedAt: new Date(), status: "OFFBOARDED" },
  });
  if (!res.count) return { ok: false, error: "notFound" };
  await audit(ctx, "employee.archive", "employee", id);
  revalidatePath("/[locale]/(app)", "layout");
  return { ok: true };
}

export async function createDepartmentAction(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  const ctx = await requireContext("employee.write");
  const clean = name.trim();
  if (!clean) return { ok: false, error: "required" };
  const dep = await db.department.upsert({
    where: { organizationId_name: { organizationId: ctx.orgId, name: clean } },
    create: { organizationId: ctx.orgId, name: clean },
    update: {},
  });
  return { ok: true, data: { id: dep.id, name: dep.name } };
}

// ── Rémunération ────────────────────────────────────────────

const COMP_TYPES = ["HIRE", "RAISE", "PROMOTION", "ADJUSTMENT", "BONUS", "HAVRAA"] as const;

export async function addCompensationAction(employeeId: string, fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext("compensation.write");
  const emp = await db.employee.findFirst({ where: { id: employeeId, organizationId: ctx.orgId } });
  if (!emp) return { ok: false, error: "notFound" };
  const type = oneOf(fd, "type", COMP_TYPES, "RAISE");
  const effectiveDate = date(fd, "effectiveDate");
  const baseSalary = dec(fd, "baseSalary");
  const amount = dec(fd, "amount");
  const t = await getTranslations("common");
  const errors: Record<string, string> = {};
  if (!effectiveDate) errors.effectiveDate = t("required");
  const oneOff = type === "BONUS" || type === "HAVRAA";
  if (oneOff && amount == null) errors.amount = t("required");
  if (!oneOff && baseSalary == null) errors.baseSalary = t("required");
  if (Object.keys(errors).length) return { ok: false, error: "validation", fieldErrors: errors };

  const jobTitle = str(fd, "jobTitle");
  await db.compensationEvent.create({
    data: {
      organizationId: ctx.orgId,
      employeeId,
      type,
      effectiveDate: effectiveDate!,
      baseSalary: oneOff ? null : baseSalary,
      amount: oneOff ? amount : null,
      currency: ctx.org.currency,
      jobTitle,
      reason: str(fd, "reason"),
      decidedBy: str(fd, "decidedBy") ?? ctx.user.name,
      createdById: ctx.userId,
    },
  });
  if (type === "PROMOTION" && jobTitle) await db.employee.update({ where: { id: employeeId }, data: { jobTitle } });
  await audit(ctx, "compensation.add", "employee", employeeId, { type });
  revalidatePath(`/[locale]/(app)/people/${employeeId}`, "page");
  return { ok: true };
}

export async function deleteCompensationAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("compensation.write");
  const ev = await db.compensationEvent.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!ev) return { ok: false, error: "notFound" };
  await db.compensationEvent.delete({ where: { id } });
  await audit(ctx, "compensation.delete", "employee", ev.employeeId, { type: ev.type });
  revalidatePath(`/[locale]/(app)/people/${ev.employeeId}`, "page");
  return { ok: true };
}
