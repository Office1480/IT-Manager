"use client";
import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import type { CompensationType } from "@prisma/client";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { addCompensationAction, deleteCompensationAction } from "@/server/employee-actions";
import { fmtDate, fmtMoney } from "@/lib/format";
import { toDateInput } from "@/lib/utils";

export type CompRow = {
  id: string;
  type: CompensationType;
  effectiveDate: Date;
  baseSalary: number | null;
  amount: number | null;
  currency: string;
  jobTitle: string | null;
  reason: string | null;
  decidedBy: string | null;
};

const TONE: Record<CompensationType, "accent" | "success" | "info" | "neutral" | "warning"> = {
  HIRE: "info",
  RAISE: "success",
  PROMOTION: "accent",
  ADJUSTMENT: "neutral",
  BONUS: "warning",
  HAVRAA: "warning",
};

function SalaryChart({ points, locale, currency }: { points: { date: Date; value: number }[]; locale: string; currency: string }) {
  if (points.length < 2) return null;
  const W = 640, H = 140, P = 8;
  const now = Date.now();
  const xs = [...points.map((p) => p.date.getTime()), now];
  const min = Math.min(...points.map((p) => p.value)) * 0.92;
  const max = Math.max(...points.map((p) => p.value)) * 1.04;
  const x = (t: number) => P + ((t - xs[0]) / (xs[xs.length - 1] - xs[0] || 1)) * (W - P * 2);
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - P * 2);
  let d = `M ${x(xs[0])} ${y(points[0].value)}`;
  points.forEach((p, i) => {
    if (i > 0) d += ` H ${x(p.date.getTime())} V ${y(p.value)}`;
  });
  d += ` H ${x(now)}`;
  const area = `${d} V ${H} H ${x(xs[0])} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none" role="img" aria-label="salary">
      <defs>
        <linearGradient id="salfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#salfill)" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(p.date.getTime())} cy={y(p.value)} r="3.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke">
          <title>
            {fmtDate(p.date, locale)} — {fmtMoney(p.value, locale, currency)}
          </title>
        </circle>
      ))}
    </svg>
  );
}

export function CompensationPanel({ rows, employeeId, canWrite, currency }: { rows: CompRow[]; employeeId: string; canWrite: boolean; currency: string }) {
  const t = useTranslations("compensation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CompensationType>(rows.length ? "RAISE" : "HIRE");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const salaryPoints = useMemo(
    () =>
      rows
        .filter((r) => r.baseSalary != null)
        .map((r) => ({ date: new Date(r.effectiveDate), value: r.baseSalary! }))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [rows],
  );
  const current = salaryPoints.filter((p) => p.date.getTime() <= Date.now()).at(-1) ?? salaryPoints.at(-1);
  const first = salaryPoints[0];
  const growth = current && first && first.value ? ((current.value - first.value) / first.value) * 100 : 0;
  const oneOff = type === "BONUS" || type === "HAVRAA";

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await addCompensationAction(employeeId, fd);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(tc("error"));
      }
      toast.success(tc("created"));
      setOpen(false);
      setErrors({});
      router.refresh();
    });
  };

  const remove = (id: string) => {
    if (!confirm(tc("confirmDelete"))) return;
    start(async () => {
      await deleteCompensationAction(id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5 md:col-span-1">
          <div className="text-xs font-medium text-fg-muted">{t("current")}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight tabular">{current ? fmtMoney(current.value, locale, currency) : "—"}</div>
          <div className="mt-1 text-xs text-fg-subtle">{t("monthlyGross")}</div>
          {salaryPoints.length > 1 && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-2 py-1 text-xs font-medium text-success">
              <TrendingUp className="size-3.5" />+{growth.toFixed(1)} % {t("sinceHire")}
            </div>
          )}
        </Card>
        <Card className="p-5 md:col-span-2">
          {salaryPoints.length > 1 ? (
            <SalaryChart points={salaryPoints} locale={locale} currency={currency} />
          ) : (
            <div className="flex h-36 items-center justify-center text-xs text-fg-subtle">{t("emptyHint")}</div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title={t("title")}
          action={
            canWrite && (
              <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
                <Plus />
                {t("add")}
              </Button>
            )
          }
        />
        {rows.length === 0 ? (
          <EmptyState icon={<TrendingUp />} title={t("empty")} description={t("emptyHint")} />
        ) : (
          <ol className="relative px-5 py-4">
            {rows.map((r, i) => (
              <li key={r.id} className="group relative flex gap-4 pb-5 last:pb-0">
                {i < rows.length - 1 && <span className="absolute start-[7px] top-5 h-full w-px bg-border" />}
                <span className="relative mt-1.5 size-[15px] shrink-0 rounded-full border-2 border-accent bg-surface" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[r.type]}>{t(`types.${r.type}`)}</Badge>
                    <span className="text-xs text-fg-subtle tabular">{fmtDate(r.effectiveDate, locale)}</span>
                    {r.decidedBy && <span className="text-xs text-fg-subtle">· {t("decidedBy")} {r.decidedBy}</span>}
                  </div>
                  <div className="mt-1 text-[15px] font-semibold tabular">
                    {r.baseSalary != null ? fmtMoney(r.baseSalary, locale, r.currency) : `+ ${fmtMoney(r.amount, locale, r.currency)}`}
                    {r.jobTitle && <span className="ms-2 text-[13px] font-normal text-fg-muted">· {r.jobTitle}</span>}
                  </div>
                  {r.reason && <p className="mt-0.5 text-[13px] text-fg-muted">{r.reason}</p>}
                </div>
                {canWrite && (
                  <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => remove(r.id)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("add")}>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("type")}>
              <Select name="type" value={type} onChange={(e) => setType(e.target.value as CompensationType)}>
                {(["HIRE", "RAISE", "PROMOTION", "ADJUSTMENT", "BONUS", "HAVRAA"] as const).map((c) => (
                  <option key={c} value={c}>
                    {t(`types.${c}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("effectiveDate")} error={errors.effectiveDate} required>
              <Input type="date" name="effectiveDate" defaultValue={toDateInput(new Date())} />
            </Field>
            {oneOff ? (
              <Field label={`${t("amount")} (${currency})`} error={errors.amount} required className="sm:col-span-2">
                <Input type="number" name="amount" step="1" min="0" />
              </Field>
            ) : (
              <Field label={`${t("baseSalary")} (${currency})`} error={errors.baseSalary} required className="sm:col-span-2">
                <Input type="number" name="baseSalary" step="1" min="0" defaultValue={current?.value} />
              </Field>
            )}
            {type === "PROMOTION" && (
              <Field label={t("jobTitle")} className="sm:col-span-2">
                <Input name="jobTitle" />
              </Field>
            )}
            <Field label={t("decidedBy")} className="sm:col-span-2">
              <Input name="decidedBy" />
            </Field>
            <Field label={t("reason")} className="sm:col-span-2">
              <Textarea name="reason" rows={3} />
            </Field>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {tc("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
