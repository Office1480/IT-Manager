import { useTranslations } from "next-intl";
import type { AssetStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { daysUntil } from "@/lib/utils";

const TONE: Record<AssetStatus, "success" | "accent" | "warning" | "danger" | "neutral"> = {
  IN_STOCK: "success",
  ASSIGNED: "accent",
  IN_REPAIR: "warning",
  LOST: "danger",
  RETIRED: "neutral",
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const t = useTranslations("assets.status");
  return <Badge tone={TONE[status]} dot>{t(status)}</Badge>;
}

export function WarrantyBadge({ end, compact }: { end: Date | null; compact?: boolean }) {
  const t = useTranslations("assets");
  const left = daysUntil(end);
  if (left == null) return compact ? <span className="text-fg-subtle">—</span> : <Badge>{t("noWarranty")}</Badge>;
  if (left < 0) return <Badge tone="danger">{t("warrantyExpired")}</Badge>;
  if (left <= 60) return <Badge tone="warning">{t("warrantyLeft", { count: left })}</Badge>;
  return <Badge tone="success">{t("warrantyLeft", { count: left })}</Badge>;
}
