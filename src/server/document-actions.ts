"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, deleteObject, putObject } from "@/lib/storage";
import { requireContext } from "./context";
import { audit } from "./audit";
import { date, oneOf, str } from "./form";
import type { ActionResult } from "./action-result";

const CATEGORIES = [
  "ID_CARD", "PASSPORT", "CONTRACT", "CONTRACT_ANNEX", "FORM_101", "PAYSLIP", "DIPLOMA", "CERTIFICATE",
  "MEDICAL", "BANK", "PURCHASE_PROOF", "HANDOVER_FORM", "RETURN_FORM", "WARRANTY", "OTHER",
] as const;

export async function uploadDocumentAction(fd: FormData): Promise<ActionResult> {
  const ctx = await requireContext("document.write");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "required" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "tooLarge" };
  if (!ALLOWED_MIME.has(file.type)) return { ok: false, error: "badType" };

  const employeeId = str(fd, "employeeId");
  const assetId = str(fd, "assetId");
  if (employeeId && !(await db.employee.findFirst({ where: { id: employeeId, organizationId: ctx.orgId } }))) return { ok: false, error: "notFound" };
  if (assetId && !(await db.asset.findFirst({ where: { id: assetId, organizationId: ctx.orgId } }))) return { ok: false, error: "notFound" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await putObject(ctx.orgId, buffer);
  const doc = await db.document.create({
    data: {
      organizationId: ctx.orgId,
      employeeId,
      assetId,
      category: oneOf(fd, "category", CATEGORIES, "OTHER"),
      title: str(fd, "title") ?? file.name.replace(/\.[^.]+$/, ""),
      fileName: file.name,
      mimeType: file.type,
      size: stored.size,
      storageKey: stored.key,
      sha256: stored.sha256,
      expiresAt: date(fd, "expiresAt"),
      uploadedById: ctx.userId,
      uploadedByName: ctx.user.name,
    },
  });
  await audit(ctx, "document.upload", employeeId ? "employee" : "asset", employeeId ?? assetId, { documentId: doc.id, category: doc.category });
  revalidatePath("/[locale]/(app)", "layout");
  return { ok: true };
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("document.write");
  const doc = await db.document.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!doc) return { ok: false, error: "notFound" };
  await db.document.delete({ where: { id } });
  await deleteObject(doc.storageKey);
  await audit(ctx, "document.delete", doc.employeeId ? "employee" : "asset", doc.employeeId ?? doc.assetId, { title: doc.title });
  revalidatePath("/[locale]/(app)", "layout");
  return { ok: true };
}
