"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boxes, Search } from "lucide-react";
import type { AssetCategory, AssetStatus } from "@prisma/client";
import { Link, useRouter } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, Table, Td, Th } from "@/components/ui/misc";
import { fmtMoney } from "@/lib/format";
import { daysUntil } from "@/lib/utils";
import { AssetStatusBadge, WarrantyBadge } from "./asset-badges";
import { CategoryIcon } from "./category-icon";

export type AssetRow = {
  id: string;
  assetTag: string;
  category: AssetCategory;
  brand: string;
  model: string;
  serialNumber: string;
  status: AssetStatus;
  purchasePrice: number | null;
  currency: string;
  warrantyEndDate: Date | null;
  holder: { id: string; firstName: string; lastName: string } | null;
  pendingSignature: boolean;
};

export function AssetsTable({ rows }: { rows: AssetRow[] }) {
  const t = useTranslations("assets");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [cat, setCat] = useState("");
  const [warranty, setWarranty] = useState(false);
  const dq = useDeferredValue(q);

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))], [rows]);
  const filtered = useMemo(() => {
    const n = dq.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (cat && r.category !== cat) return false;
      if (warranty) {
        const d = daysUntil(r.warrantyEndDate);
        if (d == null || d > 60) return false;
      }
      if (!n) return true;
      return `${r.assetTag} ${r.brand} ${r.model} ${r.serialNumber} ${r.holder ? `${r.holder.firstName} ${r.holder.lastName}` : ""}`.toLowerCase().includes(n);
    });
  }, [rows, dq, status, cat, warranty]);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="ps-8" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">{t("fields.status")} : {tc("all")}</option>
          {(["IN_STOCK", "ASSIGNED", "IN_REPAIR", "LOST", "RETIRED"] as const).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </Select>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto">
          <option value="">{t("fields.category")} : {tc("all")}</option>
          {categories.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
        </Select>
        <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 text-[13px] text-fg-muted">
          <input type="checkbox" checked={warranty} onChange={(e) => setWarranty(e.target.checked)} className="accent-[var(--accent)]" />
          {t("stats.warranty")}
        </label>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={<Boxes />} title={rows.length ? tc("noResults") : t("empty")} description={rows.length ? undefined : t("emptyHint")} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("fields.model")}</Th>
              <Th>{t("fields.serialNumber")}</Th>
              <Th>{t("fields.holder")}</Th>
              <Th className="hidden lg:table-cell">{t("fields.warrantyEndDate")}</Th>
              <Th className="hidden text-end md:table-cell">{t("fields.purchasePrice")}</Th>
              <Th>{t("fields.status")}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} onClick={() => router.push(`/assets/${r.id}`)} className="cursor-pointer transition-colors hover:bg-surface-hover">
                <Td>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-bg-subtle text-fg-muted"><CategoryIcon category={r.category} className="size-4" /></span>
                    <div>
                      <Link href={`/assets/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{r.brand} {r.model}</Link>
                      <div className="text-xs text-fg-subtle">{r.assetTag} · {t(`category.${r.category}`)}</div>
                    </div>
                  </div>
                </Td>
                <Td className="font-mono text-xs text-fg-muted">{r.serialNumber}</Td>
                <Td>
                  {r.holder ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar id={r.holder.id} firstName={r.holder.firstName} lastName={r.holder.lastName} size={22} />
                      {r.holder.firstName} {r.holder.lastName}
                      {r.pendingSignature && <Badge tone="warning">✍</Badge>}
                    </span>
                  ) : <span className="text-fg-subtle">—</span>}
                </Td>
                <Td className="hidden lg:table-cell"><WarrantyBadge end={r.warrantyEndDate} compact /></Td>
                <Td className="hidden text-end tabular text-fg-muted md:table-cell">{r.purchasePrice != null ? fmtMoney(r.purchasePrice, locale, r.currency) : "—"}</Td>
                <Td><AssetStatusBadge status={r.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
