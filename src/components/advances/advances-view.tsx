"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Banknote, Check, HandCoins, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { RequestStatus } from "@prisma/client";
import { Link, useRouter } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState, Table, Td, Th } from "@/components/ui/misc";
import { cancelAdvanceAction, createAdvanceAction, markAdvancePaidAction, reviewAdvanceAction } from "@/server/leave-actions";
import { fmtDate, fmtMoney } from "@/lib/format";

export type AdvanceRow = {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  amount: number;
  currency: string;
  installments: number;
  firstDeduction: Date;
  status: RequestStatus;
  reason: string | null;
  createdAt: Date;
  paidAt: Date | null;
  reviewerName: string | null;
};

const TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral" } as const;

export function NewAdvanceDialog({ currency, employees, me }: { currency: string; employees?: { id: string; firstName: string; lastName: string }[]; me: string | null }) {
  const t = useTranslations("advances");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [inst, setInst] = useState("1");
  const [pending, start] = useTransition();
  const next = new Date();
  const defMonth = new Date(Date.UTC(next.getFullYear(), next.getMonth() + 1, 1)).toISOString().slice(0, 7);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus />{t("new")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("new")}>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                const res = await createAdvanceAction(fd);
                if (!res.ok) return void toast.error(tc("error"));
                toast.success(t("submitted"));
                setOpen(false);
                router.refresh();
              });
            }}
          >
            {employees && (
              <Field label={t("employee")} className="sm:col-span-2">
                <Select name="employeeId" defaultValue={me ?? ""}>{employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</Select>
              </Field>
            )}
            <Field label={`${t("amount")} (${currency})`} required><Input name="amount" type="number" min={1} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
            <Field label={t("installments")}><Input name="installments" type="number" min={1} max={24} value={inst} onChange={(e) => setInst(e.target.value)} /></Field>
            <Field label={t("firstDeduction")}><Input name="firstDeduction" type="month" defaultValue={defMonth} /></Field>
            <div className="flex items-end">
              {Number(amount) > 0 && <div className="w-full rounded-lg bg-bg-subtle px-3 py-2 text-[13px] font-medium tabular">{t("perMonth", { amount: fmtMoney(Number(amount) / Math.max(1, Number(inst) || 1), locale, currency) })}</div>}
            </div>
            <Field label={t("reason")} className="sm:col-span-2"><Textarea name="reason" rows={2} /></Field>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" variant="primary" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{tc("save")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AdvancesTable({ rows, canApprove, me }: { rows: AdvanceRow[]; canApprove: boolean; me: string | null }) {
  const t = useTranslations("advances");
  const tl = useTranslations("leave");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean }>) => start(async () => { const r = await fn(); if (r.ok) router.refresh(); else toast.error(tc("error")); });
  if (!rows.length) return <Card><EmptyState icon={<HandCoins />} title={t("empty")} description={t("emptyHint")} /></Card>;
  const month = (d: Date, add: number) => new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale, { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + add, 1)));
  return (
    <Card>
      <Table>
        <thead><tr><Th>{t("employee")}</Th><Th className="text-end">{t("amount")}</Th><Th>{t("schedule")}</Th><Th className="hidden md:table-cell">{t("requested")}</Th><Th>{t("status")}</Th><Th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>
                <Link href={`/people/${r.employee.id}`} className="flex items-center gap-2.5">
                  <Avatar id={r.employee.id} firstName={r.employee.firstName} lastName={r.employee.lastName} size={26} />
                  <div><div className="font-medium">{r.employee.firstName} {r.employee.lastName}</div>{r.reason && <div className="max-w-56 truncate text-xs text-fg-subtle">{r.reason}</div>}</div>
                </Link>
              </Td>
              <Td className="text-end font-semibold tabular">{fmtMoney(r.amount, locale, r.currency)}</Td>
              <Td className="text-xs text-fg-muted">
                <div>{r.installments} × {fmtMoney(r.amount / r.installments, locale, r.currency)}</div>
                <div className="text-fg-subtle">{month(r.firstDeduction, 0)}{r.installments > 1 ? ` → ${month(r.firstDeduction, r.installments - 1)}` : ""}</div>
              </Td>
              <Td className="hidden text-fg-muted tabular md:table-cell">{fmtDate(r.createdAt, locale)}</Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  <Badge tone={TONE[r.status]} dot>{tl(`status.${r.status}`)}</Badge>
                  {r.paidAt && <span className="text-[11px] text-fg-subtle">{t("paid", { date: fmtDate(r.paidAt, locale) })}</span>}
                </div>
              </Td>
              <Td className="text-end">
                <div className="flex justify-end gap-1">
                  {canApprove && r.status === "PENDING" && (
                    <>
                      <Button size="icon" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(() => reviewAdvanceAction(r.id, "REJECTED", prompt(tl("rejectReason")) ?? undefined))}><X /></Button>
                      <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => reviewAdvanceAction(r.id, "APPROVED"))}><Check />{tl("approve")}</Button>
                    </>
                  )}
                  {canApprove && r.status === "APPROVED" && !r.paidAt && <Button size="sm" disabled={pending} onClick={() => run(() => markAdvancePaidAction(r.id))}><Banknote />{t("markPaid")}</Button>}
                  {r.status === "PENDING" && r.employee.id === me && !canApprove && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelAdvanceAction(r.id))}>{tc("cancel")}</Button>}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
