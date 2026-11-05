import { getLocale, getTranslations } from "next-intl/server";
import { FileCheck2, Laptop } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { CategoryIcon } from "@/components/assets/category-icon";
import { SignDialog } from "@/components/assets/assignment-dialogs";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { employeeAssignments } from "@/server/assets";

type Rows = Awaited<ReturnType<typeof employeeAssignments>>;

export async function EmployeeEquipment({ rows, canSign, signerName, currency }: { rows: Rows; canSign: boolean; signerName: string; currency: string }) {
  const t = await getTranslations("assets");
  const locale = await getLocale();
  const current = rows.filter((r) => !r.returnedAt);
  const past = rows.filter((r) => r.returnedAt);
  const total = current.reduce((s, r) => s + Number(r.liabilityAmount ?? 0), 0);

  const Line = ({ r }: { r: Rows[number] }) => {
    const name = `${r.asset.brand} ${r.asset.model}`;
    const amount = r.liabilityAmount != null ? fmtMoney(r.liabilityAmount, locale, r.asset.currency) : "—";
    return (
      <li className="flex flex-wrap items-center gap-3 px-5 py-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-bg-subtle text-fg-muted"><CategoryIcon category={r.asset.category} className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <Link href={`/assets/${r.asset.id}`} className="text-[13px] font-medium hover:underline">{name}</Link>
          <div className="text-xs text-fg-subtle">
            {r.asset.assetTag} · <span className="font-mono">{r.asset.serialNumber}</span> · {r.returnedAt ? `${fmtDate(r.assignedAt, locale)} → ${fmtDate(r.returnedAt, locale)}` : t("since", { date: fmtDate(r.assignedAt, locale) })}
          </div>
        </div>
        {!r.returnedAt && <span className="text-[13px] font-medium tabular">{amount}</span>}
        {r.handoverDocId && <a href={`/api/files/${r.handoverDocId}?inline=1`} target="_blank" rel="noreferrer"><Badge tone="success"><FileCheck2 className="size-3" />{t("handoverDoc")}</Badge></a>}
        {r.returnDocId && <a href={`/api/files/${r.returnDocId}?inline=1`} target="_blank" rel="noreferrer"><Badge tone="info"><FileCheck2 className="size-3" />{t("returnDoc")}</Badge></a>}
        {!r.signedAt && !r.returnedAt && (canSign ? <SignDialog assignmentId={r.id} assetName={name} amount={amount} signerName={signerName} /> : <Badge tone="warning">{t("pendingSignature")}</Badge>)}
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t("myEquipment")} description={current.length ? `${t("totalLiability")} : ${fmtMoney(total, locale, currency)}` : undefined} />
        {current.length ? <ul className="divide-y divide-border">{current.map((r) => <Line key={r.id} r={r} />)}</ul> : <EmptyState icon={<Laptop />} title={t("noEquipment")} />}
      </Card>
      {past.length > 0 && (
        <Card>
          <CardHeader title={t("history")} />
          <ul className="divide-y divide-border">{past.map((r) => <Line key={r.id} r={r} />)}</ul>
        </Card>
      )}
    </div>
  );
}
