import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { AppContext } from "./context";

export async function listAssets(ctx: AppContext) {
  return db.asset.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: [{ assetTag: "asc" }],
    include: {
      supplier: { select: { name: true } },
      assignments: {
        where: { returnedAt: null },
        take: 1,
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
}

export async function getAsset(ctx: AppContext, id: string) {
  const a = await db.asset.findFirst({
    where: { id, organizationId: ctx.orgId },
    include: {
      supplier: true,
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: { employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
      },
    },
  });
  if (!a) notFound();
  return a;
}

export async function supplierOptions(ctx: AppContext) {
  return db.supplier.findMany({ where: { organizationId: ctx.orgId }, orderBy: { name: "asc" } });
}

export async function nextAssetTag(orgId: string) {
  const rows = await db.asset.findMany({ where: { organizationId: orgId }, select: { assetTag: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number.parseInt(r.assetTag.replace(/\D/g, ""), 10) || 0), 0);
  return `IT-${String(max + 1).padStart(4, "0")}`;
}

export async function employeeAssignments(ctx: AppContext, employeeId: string) {
  return db.assetAssignment.findMany({
    where: { organizationId: ctx.orgId, employeeId },
    orderBy: [{ returnedAt: { sort: "asc", nulls: "first" } }, { assignedAt: "desc" }],
    include: { asset: { select: { id: true, assetTag: true, brand: true, model: true, serialNumber: true, category: true, replacementCost: true, purchasePrice: true, currency: true } } },
  });
}
