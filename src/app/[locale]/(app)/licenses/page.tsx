import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppWindow, CalendarClock, CircleDollarSign, Users } from "lucide-react";
import { db } from "@/lib/db";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/misc";
import { LicenseFormDialog } from "@/components/licenses/license-form";
import { fmtDate, fmtMoney } from "@/lib/format";
import { daysUntil } from "@/lib/utils";

export async function generateMetadata() {
  return { title: (await getTranslations("licenses"))("title") };
}

const monthly = (l: { costPerSeat: unknown; billingCycle: string }, seats: number) => (Number(l.costPerSeat ?? 0) * seats) / (l.billingCycle === "YEARLY" ? 12 : 1);

export default async function LicensesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("asset.read");
  const t = await getTranslations("licenses");
  const licenses = await db.license.findMany({ where: { organizationId: ctx.orgId }, orderBy: { name: "asc" }, include: { seats: { where: { revokedAt: null }, select: { id: true } } } });
  const byCur = new Map<string, number>();
  for (const l of licenses) byCur.set(l.currency, (byCur.get(l.currency) ?? 0) + monthly(l, l.seatsPurchased ?? l.seats.length));
  const unused = licenses.reduce((s, l) => s + Math.max(0, (l.seatsPurchased ?? 0) - l.seats.length), 0);
  const renewals = licenses.filter((l) => { const d = daysUntil(l.renewalDate); return d != null && d >= 0 && d <= 30; }).length;
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} actions={ctx.can("asset.write") && <LicenseFormDialog />} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("monthlyCost")} value={[...byCur].map(([c, v]) => fmtMoney(v, locale, c)).join(" + ") || "—"} icon={<CircleDollarSign />} />
        <StatCard label={t("seats")} value={licenses.reduce((s, l) => s + l.seats.length, 0)} icon={<Users />} tone="info" />
        <StatCard label={t("unused")} value={unused} icon={<AppWindow />} tone={unused ? "warning" : "success"} />
        <StatCard label={t("renewalSoon")} value={renewals} icon={<CalendarClock />} tone={renewals ? "warning" : "success"} />
      </div>
      <Card>
        {licenses.length === 0 ? <EmptyState icon={<AppWindow />} title={t("empty")} description={t("emptyHint")} /> : (
          <Table>
            <thead><tr><Th>{t("fields.name")}</Th><Th>{t("seats")}</Th><Th className="text-end">{t("monthlyCost")}</Th><Th className="hidden md:table-cell">{t("fields.renewalDate")}</Th></tr></thead>
            <tbody>
              {licenses.map((l) => {
                const total = l.seatsPurchased ?? l.seats.length;
                const pct = total ? Math.min(100, (l.seats.length / total) * 100) : 0;
                const d = daysUntil(l.renewalDate);
                return (
                  <tr key={l.id} className="hover:bg-surface-hover">
                    <Td><Link href={`/licenses/${l.id}`} className="font-medium hover:underline">{l.name}</Link><div className="text-xs text-fg-subtle">{[l.vendor, l.category].filter(Boolean).join(" · ")}</div></Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-bg-subtle"><div className={`h-full rounded-full ${l.seats.length > total ? "bg-danger" : "bg-accent"}`} style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs text-fg-muted tabular">{t("used", { used: l.seats.length, total })}</span>
                      </div>
                    </Td>
                    <Td className="text-end tabular">{fmtMoney(monthly(l, total), locale, l.currency)}<div className="text-[11px] text-fg-subtle">{l.costPerSeat != null ? t("perSeat", { amount: fmtMoney(l.costPerSeat, locale, l.currency) }) : ""} · {t(`cycle.${l.billingCycle}`)}</div></Td>
                    <Td className="hidden md:table-cell">{l.renewalDate ? <span className="inline-flex items-center gap-2 tabular">{fmtDate(l.renewalDate, locale)}{d != null && d >= 0 && d <= 30 && <Badge tone="warning">{d} j</Badge>}</span> : "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
