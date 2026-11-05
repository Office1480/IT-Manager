"use client";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { createLeaveRequestAction, previewLeaveDaysAction } from "@/server/leave-actions";
import { cn, toDateInput } from "@/lib/utils";

export type LeaveTypeOption = { id: string; code: string; name: string; color: string; requiresDocument: boolean; balanceCode: string | null };

export function LeaveRequestDialog({
  types,
  balances,
  employees,
  defaultEmployeeId,
  label,
}: {
  types: LeaveTypeOption[];
  balances: Record<string, number>;
  employees?: { id: string; firstName: string; lastName: string }[];
  defaultEmployeeId?: string | null;
  label?: string;
}) {
  const t = useTranslations("leave");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [start, setStart] = useState(toDateInput(new Date()));
  const [end, setEnd] = useState(toDateInput(new Date()));
  const [startHalf, setStartHalf] = useState(false);
  const [endHalf, setEndHalf] = useState(false);
  const [days, setDays] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startT] = useTransition();
  const type = types.find((x) => x.id === typeId);
  const forOther = employees && employees.length > 0;

  useEffect(() => {
    if (!open || !start || !end) return;
    let alive = true;
    const h = setTimeout(async () => {
      const n = await previewLeaveDaysAction(start, end < start ? start : end, startHalf, endHalf);
      if (alive) setDays(n);
    }, 120);
    return () => { alive = false; clearTimeout(h); };
  }, [open, start, end, startHalf, endHalf]);

  const balance = type?.balanceCode ? balances[type.balanceCode] : undefined;
  const after = balance != null && days != null ? Math.round((balance - days) * 10) / 10 : null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startT(async () => {
      const res = await createLeaveRequestAction(fd);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] : tc("error"));
      }
      toast.success(t("submitted"));
      setOpen(false);
      setErrors({});
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><CalendarPlus />{label ?? t("new")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("new")}>
          <form onSubmit={submit} className="space-y-4">
            {forOther && (
              <Field label={t("newFor")}>
                <Select name="employeeId" defaultValue={defaultEmployeeId ?? ""}>
                  {employees!.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </Select>
              </Field>
            )}
            <div>
              <div className="mb-1.5 text-xs font-medium text-fg-muted">{t("type")}</div>
              <input type="hidden" name="leaveTypeId" value={typeId} />
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {types.map((ty) => (
                  <button
                    type="button"
                    key={ty.id}
                    onClick={() => setTypeId(ty.id)}
                    className={cn("flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-start text-[12px] font-medium transition-all hover:border-border-strong", typeId === ty.id && "border-transparent ring-2")}
                    style={typeId === ty.id ? { ["--tw-ring-color" as string]: ty.color, background: `${ty.color}14` } : undefined}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: ty.color }} />
                    <span className="truncate">{ty.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("start")} error={errors.startDate}>
                <Input type="date" name="startDate" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} required />
                <label className="mt-1 flex items-center gap-1.5 text-xs text-fg-muted"><input type="checkbox" name="startHalf" checked={startHalf} onChange={(e) => setStartHalf(e.target.checked)} className="accent-[var(--accent)]" />{t("startHalf")}</label>
              </Field>
              <Field label={t("end")} error={errors.endDate}>
                <Input type="date" name="endDate" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
                <label className="mt-1 flex items-center gap-1.5 text-xs text-fg-muted"><input type="checkbox" name="endHalf" checked={endHalf} onChange={(e) => setEndHalf(e.target.checked)} className="accent-[var(--accent)]" />{t("endHalf")}</label>
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-bg-subtle px-4 py-3">
              <div className="text-[15px] font-semibold tabular">{days == null ? "…" : t("daysCount", { count: days })}</div>
              {after != null && <div className={cn("text-xs font-medium", after < 0 ? "text-danger" : "text-fg-muted")}>{t("balanceAfter", { count: after })}</div>}
            </div>
            {type?.code === "SICK" && <p className="flex items-start gap-1.5 text-xs text-fg-muted"><Info className="mt-0.5 size-3.5 shrink-0" />{t("sickPayInfo")}</p>}
            {type?.requiresDocument && <p className="flex items-start gap-1.5 text-xs text-warning"><Info className="mt-0.5 size-3.5 shrink-0" />{t("docRequired")}</p>}
            <Field label={t("reason")}><Textarea name="reason" rows={2} /></Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" variant="primary" disabled={pending || !days}>{pending && <Loader2 className="animate-spin" />}{t("submit")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
