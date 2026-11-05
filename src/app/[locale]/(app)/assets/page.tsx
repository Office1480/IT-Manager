import { getTranslations, setRequestLocale } from "next-intl/server";
import { PenLine, Plus, ShieldAlert, UserCheck, Wallet } from "lucide-react";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { listAssets } from "@/server/assets";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { AssetsTable } from "@/components/assets/assets-table";
import { fmtMoney } from "@/lib/format";
import { daysUntil } from "@/lib/utils";

export async function generateMetadata() {
  return { title: (await getTranslations("assets"))("title") };
}

export default async function AssetsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("asset.read");
  const t = await getTranslations("assets");
  const assets = await listAssets(ctx);
  const active = assets.filter((a) => a.status !== "RETIRED" && a.status !== "LOST");
  const value = active.filter((a) => a.currency === ctx.org.currency).reduce((s, a) => s + Number(a.purchasePrice ?? 0), 0);
  const warranty = active.filter((a) => { const d = daysUntil(a.warrantyEndDate); return d != null && d <= 60; }).length;
  const pending = assets.filter((a) => a.assignments[0] && !a.assignments[0].signedAt).length;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { count: active.length })}
        actions={ctx.can("asset.write") && <Button asChild variant="primary"><Link href="/assets/new"><Plus />{t("new")}</Link></Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("stats.value")} value={fmtMoney(value, locale, ctx.org.currency)} sub={`${active.length} ${t("stats.total").toLowerCase()}`} icon={<Wallet />} />
        <StatCard label={t("stats.assigned")} value={assets.filter((a) => a.status === "ASSIGNED").length} sub={`${assets.filter((a) => a.status === "IN_STOCK").length} ${t("stats.inStock").toLowerCase()}`} icon={<UserCheck />} tone="info" />
        <StatCard label={t("stats.warranty")} value={warranty} icon={<ShieldAlert />} tone={warranty ? "warning" : "success"} />
        <StatCard label={t("stats.pendingSignature")} value={pending} icon={<PenLine />} tone={pending ? "warning" : "success"} />
      </div>
      <AssetsTable
        rows={assets.map((a) => ({
          id: a.id, assetTag: a.assetTag, category: a.category, brand: a.brand, model: a.model, serialNumber: a.serialNumber, status: a.status,
          purchasePrice: a.purchasePrice == null ? null : Number(a.purchasePrice), currency: a.currency, warrantyEndDate: a.warrantyEndDate,
          holder: a.assignments[0]?.employee ?? null, pendingSignature: !!a.assignments[0] && !a.assignments[0].signedAt,
        }))}
      />
    </>
  );
}
