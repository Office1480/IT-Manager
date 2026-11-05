"use client";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarX2, X } from "lucide-react";
import { toast } from "sonner";
import type { RequestStatus } from "@prisma/client";
import { useRouter } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { cancelLeaveAction } from "@/server/leave-actions";
import { fmtDate } from "@/lib/format";

export type RequestRow = { id: string; typeName: string; color: string; startDate: Date; endDate: Date; days: number; status: RequestStatus; reviewerName: string | null; reviewNote: string | null; createdAt: Date; canCancel: boolean };

const TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral" } as const;

export function RequestsList({ rows }: { rows: RequestRow[] }) {
  const t = useTranslations("leave");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!rows.length) return <EmptyState icon={<CalendarX2 />} title={t("noRequests")} className="py-8" />;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
          <span className="h-9 w-1 rounded-full" style={{ background: r.color }} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">{r.typeName} <span className="font-normal text-fg-subtle">· {t("daysCount", { count: r.days })}</span></div>
            <div className="text-xs text-fg-subtle tabular">
              {fmtDate(r.startDate, locale)} → {fmtDate(r.endDate, locale)} · {t("requestedOn", { date: fmtDate(r.createdAt, locale) })}
              {r.reviewerName && r.status !== "PENDING" ? ` · ${t("reviewedBy", { name: r.reviewerName })}` : ""}
            </div>
            {r.reviewNote && <div className="mt-0.5 text-xs text-fg-muted">« {r.reviewNote} »</div>}
          </div>
          <Badge tone={TONE[r.status]} dot>{t(`status.${r.status}`)}</Badge>
          {r.canCancel && (
            <Button size="icon" variant="ghost" disabled={pending} title={t("cancel")} onClick={() => {
              if (!confirm(t("cancel") + " ?")) return;
              start(async () => { const res = await cancelLeaveAction(r.id); if (res.ok) { toast.success(t("cancelled")); router.refresh(); } else toast.error(tc("error")); });
            }}><X /></Button>
          )}
        </li>
      ))}
    </ul>
  );
}
