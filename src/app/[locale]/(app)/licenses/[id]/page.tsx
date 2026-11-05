import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { employeeOptions } from "@/server/employees";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescList } from "@/components/ui/misc";
import { LicenseFormDialog } from "@/components/licenses/license-form";
import { Seats } from "@/components/licenses/seats";
import { fmtDate, fmtMoney } from "@/lib/format";

export default async function LicensePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("asset.read");
  const t = await getTranslations("licenses");
  const l = await db.license.findFirst({
    where: { id, organizationId: ctx.orgId },
    include: { seats: { where: { revokedAt: null }, orderBy: { assignedAt: "desc" }, include: { employee: { select: { id: true, firstName: true, lastName: true, status: true } } } } },
  });
  if (!l) notFound();
  const employees = await employeeOptions(ctx);
  const total = l.seatsPurchased ?? l.seats.length;
  const monthly = (Number(l.costPerSeat ?? 0) * total) / (l.billingCycle === "YEARLY" ? 12 : 1);
  return (
    <div className="space-y-6">
      <div className="text-xs text-fg-subtle"><Link href="/licenses" className="hover:text-fg">{t("title")}</Link></div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight">{l.name}</h1>
          <p className="mt-1 text-[13px] text-fg-muted">{[l.vendor, l.category].filter(Boolean).join(" · ")}</p>
        </div>
        {ctx.can("asset.write") && <LicenseFormDialog initial={{ ...l, costPerSeat: l.costPerSeat == null ? null : Number(l.costPerSeat) }} />}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Seats licenseId={l.id} seats={l.seats} employees={employees} canWrite={ctx.can("asset.write")} />
        </div>
        <Card>
          <CardHeader title={t("fields.name")} />
          <CardBody>
            <DescList className="sm:grid-cols-1" items={[
              { label: t("seats"), value: t("used", { used: l.seats.length, total }) },
              { label: t("fields.costPerSeat"), value: l.costPerSeat != null ? `${fmtMoney(l.costPerSeat, locale, l.currency)} · ${t(`cycle.${l.billingCycle}`)}` : "—" },
              { label: t("monthlyCost"), value: fmtMoney(monthly, locale, l.currency) },
              { label: t("yearlyCost"), value: fmtMoney(monthly * 12, locale, l.currency) },
              { label: t("fields.renewalDate"), value: fmtDate(l.renewalDate, locale) },
              { label: t("fields.url"), value: l.url ? <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">{l.url.replace(/^https?:\/\//, "")}<ExternalLink className="size-3" /></a> : "—" },
              ...(l.notes ? [{ label: t("fields.notes"), value: l.notes }] : []),
            ]} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
