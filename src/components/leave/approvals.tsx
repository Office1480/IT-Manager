"use client";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Check, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { reviewLeaveAction } from "@/server/leave-actions";
import { fmtDate } from "@/lib/format";

export type ApprovalRow = {
  id: string;
  employee: { id: string; firstName: string; lastName: string; jobTitle: string | null };
  typeName: string;
  color: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string | null;
  createdAt: Date;
  conflicts: { projectName: string; reason: "noBackup" | "bothAway"; otherName: string | null; criticality: string }[];
};

export function Approvals({ rows }: { rows: ApprovalRow[] }) {
  const t = useTranslations("leave");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (id: string, d: "APPROVED" | "REJECTED") =>
    start(async () => {
      const note = d === "REJECTED" ? (prompt(t("rejectReason")) ?? undefined) : undefined;
      const res = await reviewLeaveAction(id, d, note);
      if (!res.ok) return void toast.error(tc("error"));
      toast.success(d === "APPROVED" ? t("approved") : t("rejected"));
      router.refresh();
    });
  return (
    <Card>
      <CardHeader title={t("pending")} description={rows.length ? String(rows.length) : undefined} />
      {rows.length === 0 ? (
        <EmptyState icon={<Inbox />} title={t("noPending")} className="py-8" />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Link href={`/people/${r.employee.id}?tab=leave`}><Avatar id={r.employee.id} firstName={r.employee.firstName} lastName={r.employee.lastName} size={32} /></Link>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{r.employee.firstName} {r.employee.lastName}</div>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                    <span className="inline-flex items-center gap-1 font-medium" style={{ color: r.color }}><span className="size-1.5 rounded-full" style={{ background: r.color }} />{r.typeName}</span>
                    <span className="tabular">{fmtDate(r.startDate, locale, { day: "numeric", month: "short" })} → {fmtDate(r.endDate, locale, { day: "numeric", month: "short" })}</span>
                    <span>· {t("daysCount", { count: r.days })}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" disabled={pending} onClick={() => act(r.id, "REJECTED")} title={t("reject")}><X /></Button>
                  <Button size="sm" variant="primary" disabled={pending} onClick={() => act(r.id, "APPROVED")}><Check />{t("approve")}</Button>
                </div>
              </div>
              {r.reason && <p className="ms-11 mt-1.5 text-xs text-fg-muted">« {r.reason} »</p>}
              {r.conflicts.length > 0 && (
                <div className="ms-11 mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                  <div className="mb-0.5 flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-3.5" />{t("coverageRisk")}</div>
                  {r.conflicts.map((c, i) => (
                    <div key={i}>{c.reason === "noBackup" ? t("noBackup", { project: c.projectName }) : t("bothAway", { project: c.projectName, name: c.otherName ?? "" })}</div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
