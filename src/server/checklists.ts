import "server-only";
import type { ChecklistKind } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_OFFBOARDING, DEFAULT_ONBOARDING } from "@/lib/israel-defaults";

/** Génère la checklist (idempotent : ne recrée pas une checklist existante). */
export async function ensureChecklist(orgId: string, employeeId: string, kind: ChecklistKind, labels: { returnAsset: (n: string) => string; revokeLicense: (n: string) => string }) {
  const existing = await db.checklistTask.count({ where: { employeeId, kind } });
  if (existing) return;
  const template = kind === "ONBOARDING" ? DEFAULT_ONBOARDING : DEFAULT_OFFBOARDING;
  const rows: { title: string; category: string; assignmentId?: string; seatId?: string }[] = [...template];
  if (kind === "OFFBOARDING") {
    const [assignments, seats] = await Promise.all([
      db.assetAssignment.findMany({ where: { employeeId, returnedAt: null }, include: { asset: true } }),
      db.licenseSeat.findMany({ where: { employeeId, revokedAt: null }, include: { license: true } }),
    ]);
    for (const a of assignments) rows.push({ title: labels.returnAsset(`${a.asset.brand} ${a.asset.model} (${a.asset.assetTag})`), category: "IT", assignmentId: a.id });
    for (const s of seats) rows.push({ title: labels.revokeLicense(s.license.name), category: "IT", seatId: s.id });
  }
  await db.checklistTask.createMany({
    data: rows.map((r, i) => ({ organizationId: orgId, employeeId, kind, title: r.title, category: r.category, assignmentId: r.assignmentId, seatId: r.seatId, position: i })),
  });
}
