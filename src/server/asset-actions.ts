"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { putObject } from "@/lib/storage";
import { buildHandoverPdf } from "@/lib/pdf";
import { fmtDate, fmtMoney } from "@/lib/format";
import { requireContext, type AppContext } from "./context";
import { audit } from "./audit";
import { date, dec, oneOf, reqStr, str } from "./form";
import { nextAssetTag } from "./assets";
import type { ActionResult } from "./action-result";

const CATEGORIES = ["LAPTOP", "DESKTOP", "MONITOR", "KEYBOARD", "MOUSE", "HEADSET", "DOCKING", "PHONE", "TABLET", "PRINTER", "NETWORK", "SERVER", "ACCESSORY", "OTHER"] as const;
const STATUSES = ["IN_STOCK", "ASSIGNED", "IN_REPAIR", "LOST", "RETIRED"] as const;
const CONDITIONS = ["NEW", "GOOD", "FAIR", "DAMAGED"] as const;

const refresh = () => revalidatePath("/[locale]/(app)", "layout");

async function resolveSupplier(orgId: string, fd: FormData) {
  if (fd.get("supplierId") !== "__new") return str(fd, "supplierId");
  const name = str(fd, "newSupplier");
  if (!name) return null;
  const s = await db.supplier.upsert({
    where: { organizationId_name: { organizationId: orgId, name } },
    create: { organizationId: orgId, name },
    update: {},
  });
  return s.id;
}

function readAsset(fd: FormData) {
  return {
    category: oneOf(fd, "category", CATEGORIES, "LAPTOP"),
    brand: reqStr(fd, "brand"),
    model: reqStr(fd, "model"),
    serialNumber: reqStr(fd, "serialNumber").toUpperCase(),
    specs: str(fd, "specs"),
    condition: oneOf(fd, "condition", CONDITIONS, "NEW"),
    purchaseDate: date(fd, "purchaseDate"),
    purchasePrice: dec(fd, "purchasePrice"),
    currency: str(fd, "currency") ?? "ILS",
    invoiceNumber: str(fd, "invoiceNumber"),
    warrantyEndDate: date(fd, "warrantyEndDate"),
    warrantyProvider: str(fd, "warrantyProvider"),
    warrantyContact: str(fd, "warrantyContact"),
    warrantyEmail: str(fd, "warrantyEmail"),
    warrantyPhone: str(fd, "warrantyPhone"),
    warrantyUrl: str(fd, "warrantyUrl"),
    replacementCost: dec(fd, "replacementCost"),
    location: str(fd, "location"),
    notes: str(fd, "notes"),
  };
}

async function validate(orgId: string, data: ReturnType<typeof readAsset>, tag: string | null, excludeId?: string) {
  const t = await getTranslations();
  const errors: Record<string, string> = {};
  if (!data.brand) errors.brand = t("common.required");
  if (!data.model) errors.model = t("common.required");
  if (!data.serialNumber) errors.serialNumber = t("common.required");
  const notMe = excludeId ? { not: excludeId } : undefined;
  if (data.serialNumber && (await db.asset.findFirst({ where: { organizationId: orgId, serialNumber: data.serialNumber, id: notMe } })))
    errors.serialNumber = t("assets.serialTaken");
  if (tag && (await db.asset.findFirst({ where: { organizationId: orgId, assetTag: tag, id: notMe } }))) errors.assetTag = t("assets.tagTaken");
  return errors;
}

export async function createAssetAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireContext("asset.write");
  const data = readAsset(fd);
  const tag = str(fd, "assetTag");
  const errors = await validate(ctx.orgId, data, tag);
  if (Object.keys(errors).length) return { ok: false, error: "validation", fieldErrors: errors };
  const asset = await db.asset.create({
    data: { ...data, organizationId: ctx.orgId, assetTag: tag ?? (await nextAssetTag(ctx.orgId)), supplierId: await resolveSupplier(ctx.orgId, fd) },
  });
  await audit(ctx, "asset.create", "asset", asset.id, { tag: asset.assetTag, serial: asset.serialNumber });
  refresh();
  return { ok: true, data: { id: asset.id } };
}

export async function updateAssetAction(id: string, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireContext("asset.write");
  const existing = await db.asset.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!existing) return { ok: false, error: "notFound" };
  const data = readAsset(fd);
  const tag = str(fd, "assetTag") ?? existing.assetTag;
  const errors = await validate(ctx.orgId, data, tag, id);
  if (Object.keys(errors).length) return { ok: false, error: "validation", fieldErrors: errors };
  await db.asset.update({ where: { id }, data: { ...data, assetTag: tag, supplierId: await resolveSupplier(ctx.orgId, fd) } });
  await audit(ctx, "asset.update", "asset", id);
  refresh();
  return { ok: true, data: { id } };
}

export async function deleteAssetAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("asset.write");
  const res = await db.asset.deleteMany({ where: { id, organizationId: ctx.orgId, status: { not: "ASSIGNED" } } });
  if (!res.count) return { ok: false, error: "notFound" };
  await audit(ctx, "asset.delete", "asset", id);
  refresh();
  return { ok: true };
}

export async function setAssetStatusAction(id: string, status: (typeof STATUSES)[number]): Promise<ActionResult> {
  const ctx = await requireContext("asset.write");
  if (!STATUSES.includes(status) || status === "ASSIGNED") return { ok: false, error: "invalid" };
  const asset = await db.asset.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!asset) return { ok: false, error: "notFound" };
  if (asset.status === "ASSIGNED" && status !== "LOST") return { ok: false, error: "assigned" };
  await db.$transaction(async (tx) => {
    if (status === "LOST") await tx.assetAssignment.updateMany({ where: { assetId: id, returnedAt: null }, data: { returnedAt: new Date(), notesIn: "LOST" } });
    await tx.asset.update({ where: { id }, data: { status } });
  });
  await audit(ctx, "asset.status", "asset", id, { status });
  refresh();
  return { ok: true };
}

// ── Attribution & signature ──────────────────────────────────

async function pdfLabels(kind: "handover" | "return") {
  const locale = await getLocale();
  // Le PDF utilise des polices latines : on bascule l'hébreu sur l'anglais.
  const t = await getTranslations({ locale: locale === "he" ? "en" : locale, namespace: "assets" });
  return {
    pdfLocale: locale === "he" ? "en" : locale,
    t,
    labels: {
      title: t(kind === "handover" ? "pdf.handoverTitle" : "pdf.returnTitle"),
      employee: t("pdf.employee"),
      asset: t("pdf.asset"),
      serial: t("pdf.serial"),
      tag: t("pdf.tag"),
      date: t("pdf.date"),
      condition: t("pdf.condition"),
      liability: t("pdf.liability"),
      signature: t("pdf.signature"),
      generated: t("pdf.generated"),
    },
  };
}

async function generateSignedDoc(ctx: AppContext, assignmentId: string, kind: "handover" | "return", signature: string, signerName: string) {
  const a = await db.assetAssignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { asset: true, employee: true } });
  const { labels, t, pdfLocale } = await pdfLabels(kind);
  const amount = a.liabilityAmount != null ? fmtMoney(a.liabilityAmount, pdfLocale, a.asset.currency) : "-";
  const cond = kind === "handover" ? a.conditionOut : (a.conditionIn ?? "GOOD");
  const buf = await buildHandoverPdf({
    kind,
    labels,
    org: ctx.org.name,
    employee: `${a.employee.firstName} ${a.employee.lastName} (#${a.employee.employeeNumber})`,
    asset: `${t(`category.${a.asset.category}`)} - ${a.asset.brand} ${a.asset.model}`,
    serial: a.asset.serialNumber,
    tag: a.asset.assetTag,
    date: fmtDate(new Date(), pdfLocale),
    condition: t(`condition.${cond}`),
    liability: kind === "handover" ? amount : undefined,
    terms: kind === "handover" ? t("terms", { amount }) : t("returnTerms"),
    signerName,
    signaturePng: signature,
  });
  const stored = await putObject(ctx.orgId, buf);
  const fileName = `${kind === "handover" ? "remise" : "restitution"}-${a.asset.assetTag}-${a.employee.lastName}.pdf`.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
  const doc = await db.document.create({
    data: {
      organizationId: ctx.orgId,
      employeeId: a.employeeId,
      assetId: a.assetId,
      category: kind === "handover" ? "HANDOVER_FORM" : "RETURN_FORM",
      title: `${labels.title} — ${a.asset.assetTag}`,
      fileName,
      mimeType: "application/pdf",
      size: stored.size,
      storageKey: stored.key,
      sha256: stored.sha256,
      uploadedById: ctx.userId,
      uploadedByName: ctx.user.name,
    },
  });
  return doc.id;
}

const validSignature = (s: string | null) => !!s && s.startsWith("data:image/png;base64,") && s.length > 200 && s.length < 600_000;

export async function assignAssetAction(assetId: string, fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext("asset.write");
  const asset = await db.asset.findFirst({ where: { id: assetId, organizationId: ctx.orgId } });
  if (!asset) return { ok: false, error: "notFound" };
  if (asset.status === "ASSIGNED" || asset.status === "LOST" || asset.status === "RETIRED") return { ok: false, error: "unavailable" };
  const employeeId = str(fd, "employeeId");
  const employee = employeeId ? await db.employee.findFirst({ where: { id: employeeId, organizationId: ctx.orgId, deletedAt: null } }) : null;
  if (!employee) return { ok: false, error: "validation", fieldErrors: { employeeId: (await getTranslations("common"))("required") } };
  const mode = str(fd, "mode") ?? "later";
  const signature = str(fd, "signature");
  if (mode === "now" && (!validSignature(signature) || fd.get("accept") !== "on")) return { ok: false, error: "signature" };

  const data: Prisma.AssetAssignmentUncheckedCreateInput = {
    organizationId: ctx.orgId,
    assetId,
    employeeId: employee.id,
    liabilityAmount: dec(fd, "liabilityAmount") ?? asset.replacementCost ?? asset.purchasePrice,
    conditionOut: oneOf(fd, "conditionOut", CONDITIONS, "GOOD"),
    expectedReturn: date(fd, "expectedReturn"),
    notesOut: str(fd, "notesOut"),
  };
  const assignment = await db.$transaction(async (tx) => {
    const created = await tx.assetAssignment.create({ data });
    await tx.asset.update({ where: { id: assetId }, data: { status: "ASSIGNED", condition: data.conditionOut } });
    return created;
  });
  if (mode === "now") {
    const signerName = str(fd, "signerName") ?? `${employee.firstName} ${employee.lastName}`;
    const docId = await generateSignedDoc(ctx, assignment.id, "handover", signature!, signerName);
    await db.assetAssignment.update({ where: { id: assignment.id }, data: { signedAt: new Date(), signerName, signature, handoverDocId: docId } });
  }
  await audit(ctx, "asset.assign", "asset", assetId, { employee: `${employee.firstName} ${employee.lastName}`, signed: mode === "now" });
  refresh();
  return { ok: true };
}

/** Signature différée : par le collaborateur lui-même, ou par un gestionnaire en présentiel. */
export async function signAssignmentAction(assignmentId: string, fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext();
  const a = await db.assetAssignment.findFirst({ where: { id: assignmentId, organizationId: ctx.orgId }, include: { employee: true } });
  if (!a || a.signedAt || a.returnedAt) return { ok: false, error: "notFound" };
  if (!ctx.can("asset.write") && ctx.employeeId !== a.employeeId) return { ok: false, error: "forbidden" };
  const signature = str(fd, "signature");
  if (!validSignature(signature) || fd.get("accept") !== "on") return { ok: false, error: "signature" };
  const signerName = str(fd, "signerName") ?? `${a.employee.firstName} ${a.employee.lastName}`;
  const docId = await generateSignedDoc(ctx, a.id, "handover", signature!, signerName);
  await db.assetAssignment.update({ where: { id: a.id }, data: { signedAt: new Date(), signerName, signature, handoverDocId: docId } });
  await audit(ctx, "asset.sign", "asset", a.assetId, { assignmentId });
  refresh();
  return { ok: true };
}

export async function returnAssetAction(assignmentId: string, fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext("asset.write");
  const a = await db.assetAssignment.findFirst({ where: { id: assignmentId, organizationId: ctx.orgId, returnedAt: null }, include: { employee: true } });
  if (!a) return { ok: false, error: "notFound" };
  const conditionIn = oneOf(fd, "conditionIn", CONDITIONS, "GOOD");
  const signature = str(fd, "signature");
  await db.$transaction(async (tx) => {
    await tx.assetAssignment.update({ where: { id: a.id }, data: { returnedAt: new Date(), conditionIn, notesIn: str(fd, "notesIn") } });
    await tx.asset.update({ where: { id: a.assetId }, data: { status: conditionIn === "DAMAGED" ? "IN_REPAIR" : "IN_STOCK", condition: conditionIn } });
  });
  if (validSignature(signature)) {
    const signerName = str(fd, "signerName") ?? `${a.employee.firstName} ${a.employee.lastName}`;
    const docId = await generateSignedDoc(ctx, a.id, "return", signature!, signerName);
    await db.assetAssignment.update({ where: { id: a.id }, data: { returnSignedAt: new Date(), returnSignature: signature, returnDocId: docId } });
  }
  // Cocher automatiquement la tâche d'offboarding correspondante
  await db.checklistTask.updateMany({ where: { assignmentId: a.id, done: false }, data: { done: true, doneAt: new Date(), doneByName: ctx.user.name } });
  await audit(ctx, "asset.return", "asset", a.assetId, { employee: `${a.employee.firstName} ${a.employee.lastName}`, condition: conditionIn });
  refresh();
  return { ok: true };
}
