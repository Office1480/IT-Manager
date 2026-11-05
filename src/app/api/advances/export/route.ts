import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getContext } from "@/server/context";
import { audit } from "@/server/audit";

/** Export CSV des retenues d'avances, mois par mois, pour le prestataire de paie. */
export async function GET() {
  const ctx = await getContext();
  if (!ctx || !ctx.can("advance.approve")) return new NextResponse("Forbidden", { status: 403 });
  const rows = await db.salaryAdvance.findMany({
    where: { organizationId: ctx.orgId, status: "APPROVED" },
    include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } } },
    orderBy: { firstDeduction: "asc" },
  });
  const lines = [["employee_number", "last_name", "first_name", "month", "deduction", "currency", "advance_total", "installment", "installments"].join(",")];
  for (const r of rows) {
    const per = Math.round((Number(r.amount) / r.installments) * 100) / 100;
    for (let i = 0; i < r.installments; i++) {
      const m = new Date(Date.UTC(r.firstDeduction.getUTCFullYear(), r.firstDeduction.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
      lines.push([r.employee.employeeNumber, r.employee.lastName, r.employee.firstName, m, per.toFixed(2), r.currency, Number(r.amount).toFixed(2), i + 1, r.installments].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
  }
  await audit(ctx, "advance.export", "advance", null);
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="avances-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
