import "server-only";
import { db } from "@/lib/db";
import { DEFAULT_LEAVE_TYPES, ISRAELI_HOLIDAYS } from "@/lib/israel-defaults";

/** Initialise (idempotent) les types de congés et fêtes d'une organisation. */
export async function ensureOrgSetup(orgId: string) {
  const count = await db.leaveType.count({ where: { organizationId: orgId } });
  if (count === 0) {
    await db.leaveType.createMany({
      data: DEFAULT_LEAVE_TYPES.map((t, i) => ({
        organizationId: orgId,
        code: t.code,
        names: t.names,
        color: t.color,
        paid: t.paid,
        tracksBalance: "tracksBalance" in t ? t.tracksBalance : false,
        requiresDocument: "requiresDocument" in t ? t.requiresDocument : false,
        requiresApproval: "requiresApproval" in t ? t.requiresApproval : true,
        deductsFromCode: "deductsFromCode" in t ? t.deductsFromCode : null,
        maxBalance: "maxBalance" in t ? t.maxBalance : null,
        statutory: "statutory" in t ? t.statutory : false,
        position: i,
      })),
    });
  }
  if ((await db.holiday.count({ where: { organizationId: orgId } })) === 0) {
    await db.holiday.createMany({
      data: ISRAELI_HOLIDAYS.map((h) => ({ organizationId: orgId, date: new Date(`${h.date}T00:00:00Z`), kind: h.kind, names: h.names })),
      skipDuplicates: true,
    });
  }
}
