"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { ChecklistKind, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { encryptText } from "@/lib/crypto";
import { requireContext } from "./context";
import { audit } from "./audit";
import { bool, date, dec, int, oneOf, reqStr, str } from "./form";
import { ensureChecklist } from "./checklists";
import { decryptText } from "@/lib/crypto";
import type { ActionResult } from "./action-result";

const refresh = () => revalidatePath("/[locale]/(app)", "layout");

// ── Checklists ──────────────────────────────────────────────

export async function generateChecklistAction(employeeId: string, kind: ChecklistKind): Promise<ActionResult> {
  const ctx = await requireContext("employee.write");
  if (!(await db.employee.findFirst({ where: { id: employeeId, organizationId: ctx.orgId } }))) return { ok: false, error: "notFound" };
  const t = await getTranslations("checklist");
  await ensureChecklist(ctx.orgId, employeeId, kind, { returnAsset: (name) => t("returnAsset", { name }), revokeLicense: (name) => t("revokeLicense", { name }) });
  refresh();
  return { ok: true };
}

export async function toggleTaskAction(id: string, done: boolean): Promise<ActionResult> {
  const ctx = await requireContext("employee.write");
  const res = await db.checklistTask.updateMany({ where: { id, organizationId: ctx.orgId }, data: { done, doneAt: done ? new Date() : null, doneByName: done ? ctx.user.name : null } });
  if (!res.count) return { ok: false, error: "notFound" };
  refresh();
  return { ok: true };
}

export async function addTaskAction(employeeId: string, kind: ChecklistKind, title: string, category: string): Promise<ActionResult> {
  const ctx = await requireContext("employee.write");
  if (!title.trim()) return { ok: false, error: "required" };
  const max = await db.checklistTask.aggregate({ where: { employeeId, kind }, _max: { position: true } });
  await db.checklistTask.create({ data: { organizationId: ctx.orgId, employeeId, kind, title: title.trim(), category, position: (max._max.position ?? 0) + 1 } });
  refresh();
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("employee.write");
  await db.checklistTask.deleteMany({ where: { id, organizationId: ctx.orgId } });
  refresh();
  return { ok: true };
}

// ── Licences SaaS ───────────────────────────────────────────

export async function saveLicenseAction(id: string | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireContext("asset.write");
  const name = reqStr(fd, "name");
  if (!name) return { ok: false, error: "validation", fieldErrors: { name: (await getTranslations("common"))("required") } };
  const data = {
    name,
    vendor: str(fd, "vendor"),
    category: str(fd, "category"),
    costPerSeat: dec(fd, "costPerSeat"),
    currency: str(fd, "currency") ?? "USD",
    billingCycle: oneOf(fd, "billingCycle", ["MONTHLY", "YEARLY"] as const, "MONTHLY"),
    seatsPurchased: int(fd, "seatsPurchased"),
    renewalDate: date(fd, "renewalDate"),
    url: str(fd, "url"),
    notes: str(fd, "notes"),
  };
  const dup = await db.license.findFirst({ where: { organizationId: ctx.orgId, name, id: id ? { not: id } : undefined } });
  if (dup) return { ok: false, error: "validation", fieldErrors: { name: "≠" } };
  const lic = id
    ? (await db.license.updateMany({ where: { id, organizationId: ctx.orgId }, data }), { id })
    : await db.license.create({ data: { ...data, organizationId: ctx.orgId } });
  await audit(ctx, id ? "license.update" : "license.create", "license", lic.id, { name });
  refresh();
  return { ok: true, data: { id: lic.id } };
}

export async function deleteLicenseAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("asset.write");
  await db.license.deleteMany({ where: { id, organizationId: ctx.orgId } });
  await audit(ctx, "license.delete", "license", id);
  refresh();
  return { ok: true };
}

export async function assignSeatAction(licenseId: string, employeeId: string, accountEmail?: string): Promise<ActionResult> {
  const ctx = await requireContext("asset.write");
  const [lic, emp] = await Promise.all([
    db.license.findFirst({ where: { id: licenseId, organizationId: ctx.orgId } }),
    db.employee.findFirst({ where: { id: employeeId, organizationId: ctx.orgId } }),
  ]);
  if (!lic || !emp) return { ok: false, error: "notFound" };
  const active = await db.licenseSeat.findFirst({ where: { licenseId, employeeId, revokedAt: null } });
  if (active) return { ok: false, error: "exists" };
  await db.licenseSeat.create({ data: { organizationId: ctx.orgId, licenseId, employeeId, accountEmail: accountEmail || emp.email } });
  await audit(ctx, "license.assign", "license", licenseId, { employee: `${emp.firstName} ${emp.lastName}` });
  refresh();
  return { ok: true };
}

export async function revokeSeatAction(seatId: string): Promise<ActionResult> {
  const ctx = await requireContext("asset.write");
  const res = await db.licenseSeat.updateMany({ where: { id: seatId, organizationId: ctx.orgId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!res.count) return { ok: false, error: "notFound" };
  await db.checklistTask.updateMany({ where: { seatId, done: false }, data: { done: true, doneAt: new Date(), doneByName: ctx.user.name } });
  await audit(ctx, "license.revoke", "license", seatId);
  refresh();
  return { ok: true };
}

// ── Paramètres ──────────────────────────────────────────────

export async function updateOrgAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext("settings.manage");
  const workDays = fd.getAll("workDays").map(Number).filter((n) => n >= 0 && n <= 6);
  await db.organization.update({
    where: { id: ctx.orgId },
    data: {
      name: reqStr(fd, "name") || ctx.org.name,
      currency: oneOf(fd, "currency", ["ILS", "USD", "EUR"] as const, "ILS"),
      locale: oneOf(fd, "locale", ["fr", "en", "he"] as const, "fr"),
      workDays: workDays.length ? workDays : ctx.org.workDays,
    },
  });
  await audit(ctx, "settings.org", "organization", ctx.orgId);
  refresh();
  return { ok: true };
}

export async function updateLeaveTypeAction(id: string, fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext("leave.configure");
  await db.leaveType.updateMany({
    where: { id, organizationId: ctx.orgId },
    data: {
      active: bool(fd, "active"),
      paid: bool(fd, "paid"),
      requiresApproval: bool(fd, "requiresApproval"),
      accrualPerMonth: dec(fd, "accrualPerMonth"),
      color: /^#[0-9a-f]{6}$/i.test(str(fd, "color") ?? "") ? str(fd, "color")! : undefined,
    },
  });
  refresh();
  return { ok: true };
}

export async function addHolidayAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext("leave.configure");
  const d = date(fd, "date");
  const name = str(fd, "name");
  if (!d || !name) return { ok: false, error: "required" };
  await db.holiday.upsert({
    where: { organizationId_date: { organizationId: ctx.orgId, date: d } },
    create: { organizationId: ctx.orgId, date: d, kind: oneOf(fd, "kind", ["HOLIDAY", "EVE"] as const, "HOLIDAY"), names: { fr: name, en: name, he: name } },
    update: { kind: oneOf(fd, "kind", ["HOLIDAY", "EVE"] as const, "HOLIDAY"), names: { fr: name, en: name, he: name } },
  });
  refresh();
  return { ok: true };
}

export async function deleteHolidayAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("leave.configure");
  await db.holiday.deleteMany({ where: { id, organizationId: ctx.orgId } });
  refresh();
  return { ok: true };
}

export async function saveDepartmentAction(id: string | null, name: string, color: string): Promise<ActionResult> {
  const ctx = await requireContext("employee.write");
  if (!name.trim()) return { ok: false, error: "required" };
  const data = { name: name.trim(), color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#6366f1" };
  if (id) await db.department.updateMany({ where: { id, organizationId: ctx.orgId }, data });
  else await db.department.create({ data: { ...data, organizationId: ctx.orgId } });
  refresh();
  return { ok: true };
}

export async function deleteDepartmentAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("employee.write");
  await db.department.deleteMany({ where: { id, organizationId: ctx.orgId } });
  refresh();
  return { ok: true };
}

const ROLES: Role[] = ["OWNER", "ADMIN", "HR", "MANAGER", "EMPLOYEE"];
const tempPassword = () => randomBytes(9).toString("base64url");

export async function createAccessAction(fd: FormData): Promise<ActionResult<{ password: string }>> {
  const ctx = await requireContext("settings.manage");
  const t = await getTranslations("settings.users");
  const email = reqStr(fd, "email").toLowerCase();
  const role = oneOf(fd, "role", ROLES, "EMPLOYEE");
  if (role === "OWNER" && ctx.role !== "OWNER") return { ok: false, error: "forbidden" };
  const employeeId = str(fd, "employeeId");
  const employee = employeeId ? await db.employee.findFirst({ where: { id: employeeId, organizationId: ctx.orgId } }) : null;
  const name = str(fd, "name") ?? (employee ? `${employee.firstName} ${employee.lastName}` : email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "validation", fieldErrors: { email: "email" } };
  let user = await db.user.findUnique({ where: { email } });
  if (user && (await db.membership.findFirst({ where: { userId: user.id, organizationId: ctx.orgId } }))) return { ok: false, error: "validation", fieldErrors: { email: t("emailTaken") } };
  if (employee && (await db.membership.findFirst({ where: { employeeId: employee.id } }))) return { ok: false, error: "validation", fieldErrors: { employeeId: t("emailTaken") } };
  const password = str(fd, "password") ?? tempPassword();
  if (!user) user = await db.user.create({ data: { email, name, passwordHash: await bcrypt.hash(password, 10) } });
  await db.membership.create({ data: { userId: user.id, organizationId: ctx.orgId, role, employeeId: employee?.id } });
  await audit(ctx, "user.create", "user", user.id, { email, role });
  refresh();
  return { ok: true, data: { password } };
}

export async function updateMemberAction(membershipId: string, role: Role, employeeId: string | null): Promise<ActionResult> {
  const ctx = await requireContext("settings.manage");
  const m = await db.membership.findFirst({ where: { id: membershipId, organizationId: ctx.orgId } });
  if (!m || !ROLES.includes(role)) return { ok: false, error: "notFound" };
  if ((role === "OWNER" || m.role === "OWNER") && ctx.role !== "OWNER") return { ok: false, error: "forbidden" };
  if (m.userId === ctx.userId && role !== m.role) return { ok: false, error: "forbidden" };
  await db.membership.update({ where: { id: m.id }, data: { role, employeeId } });
  await audit(ctx, "user.role", "user", m.userId, { role });
  refresh();
  return { ok: true };
}

export async function removeMemberAction(membershipId: string): Promise<ActionResult> {
  const ctx = await requireContext("settings.manage");
  const m = await db.membership.findFirst({ where: { id: membershipId, organizationId: ctx.orgId } });
  if (!m || m.userId === ctx.userId || (m.role === "OWNER" && ctx.role !== "OWNER")) return { ok: false, error: "forbidden" };
  await db.membership.delete({ where: { id: m.id } });
  await audit(ctx, "user.remove", "user", m.userId);
  refresh();
  return { ok: true };
}

export async function resetPasswordAction(membershipId: string): Promise<ActionResult<{ password: string }>> {
  const ctx = await requireContext("settings.manage");
  const m = await db.membership.findFirst({ where: { id: membershipId, organizationId: ctx.orgId } });
  if (!m || (m.role === "OWNER" && ctx.role !== "OWNER")) return { ok: false, error: "forbidden" };
  const password = tempPassword();
  await db.user.update({ where: { id: m.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await audit(ctx, "user.resetPassword", "user", m.userId);
  return { ok: true, data: { password } };
}

export async function saveJiraAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext("settings.manage");
  const token = str(fd, "token");
  const baseUrl = str(fd, "baseUrl");
  if (baseUrl && !/^https:\/\/[a-z0-9.-]+$/i.test(baseUrl.replace(/\/+$/, ""))) return { ok: false, error: "validation", fieldErrors: { baseUrl: "https://xxx.atlassian.net" } };
  await db.organization.update({
    where: { id: ctx.orgId },
    data: {
      jiraBaseUrl: baseUrl?.replace(/\/+$/, "") ?? null,
      jiraEmail: str(fd, "email"),
      ...(token ? { jiraTokenEnc: encryptText(token) } : {}),
      jiraDefaultProject: str(fd, "defaultProject")?.toUpperCase() ?? null,
      jiraIssueType: str(fd, "issueType") ?? "Epic",
    },
  });
  await audit(ctx, "settings.jira", "organization", ctx.orgId);
  refresh();
  return { ok: true };
}

export async function testJiraAction(): Promise<ActionResult<{ name: string }>> {
  const ctx = await requireContext("settings.manage");
  const o = ctx.org;
  if (!o.jiraBaseUrl || !o.jiraEmail || !o.jiraTokenEnc) return { ok: false, error: "JIRA_NOT_CONFIGURED" };
  try {
    const res = await fetch(`${o.jiraBaseUrl}/rest/api/3/myself`, {
      headers: { Authorization: `Basic ${Buffer.from(`${o.jiraEmail}:${decryptText(o.jiraTokenEnc)}`).toString("base64")}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const j = (await res.json()) as { displayName: string };
    return { ok: true, data: { name: j.displayName } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}
