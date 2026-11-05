import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, Download, HandCoins, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireContext } from "@/server/context";
import { listAdvances } from "@/server/leave";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { AdvancesTable, NewAdvanceDialog } from "@/components/advances/advances-view";
import { fmtMoney } from "@/lib/format";

export async function generateMetadata() {
  return { title: (await getTranslations("advances"))("title") };
}

export default async function AdvancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext();
  const t = await getTranslations("advances");
  const rows = await listAdvances(ctx);
  const canApprove = ctx.can("advance.approve");
  const employees = canApprove
    ? await db.employee.findMany({ where: { organizationId: ctx.orgId, deletedAt: null, status: { not: "OFFBOARDED" } }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } })
    : undefined;

  // Encours : part non encore retenue des avances versées
  const now = new Date();
  const monthsElapsed = (d: Date) => Math.max(0, (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + now.getUTCMonth() - d.getUTCMonth() + 1);
  const outstanding = rows
    .filter((r) => r.status === "APPROVED")
    .reduce((s, r) => s + Number(r.amount) * Math.max(0, 1 - Math.min(r.installments, monthsElapsed(r.firstDeduction)) / r.installments), 0);
  const pendingTotal = rows.filter((r) => r.status === "PENDING").reduce((s, r) => s + Number(r.amount), 0);
  const paidYear = rows.filter((r) => r.paidAt && r.paidAt.getUTCFullYear() === now.getUTCFullYear()).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {canApprove && <Button asChild><a href="/api/advances/export" download><Download />{t("exportCsv")}</a></Button>}
            {(ctx.employeeId || canApprove) && <NewAdvanceDialog currency={ctx.org.currency} employees={employees} me={ctx.employeeId} />}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("outstanding")} value={fmtMoney(outstanding, locale, ctx.org.currency)} icon={<Wallet />} />
        <StatCard label={t("pendingTotal")} value={fmtMoney(pendingTotal, locale, ctx.org.currency)} icon={<Clock />} tone="warning" />
        <StatCard label={t("thisYear")} value={fmtMoney(paidYear, locale, ctx.org.currency)} icon={<HandCoins />} tone="success" />
      </div>
      <AdvancesTable canApprove={canApprove} me={ctx.employeeId} rows={rows.map((r) => ({ ...r, amount: Number(r.amount) }))} />
    </>
  );
}
