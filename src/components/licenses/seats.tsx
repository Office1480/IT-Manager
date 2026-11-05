"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trash2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { assignSeatAction, deleteLicenseAction, revokeSeatAction } from "@/server/phase5-actions";
import { fmtDate } from "@/lib/format";

type Seat = { id: string; assignedAt: Date; accountEmail: string | null; employee: { id: string; firstName: string; lastName: string; status: string } };

export function Seats({ licenseId, seats, employees, canWrite }: { licenseId: string; seats: Seat[]; employees: { id: string; firstName: string; lastName: string }[]; canWrite: boolean }) {
  const t = useTranslations("licenses");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [emp, setEmp] = useState("");
  const [account, setAccount] = useState("");
  const [pending, start] = useTransition();
  const holders = new Set(seats.map((s) => s.employee.id));
  return (
    <Card>
      <CardHeader title={t("holders")} description={String(seats.length)} />
      {canWrite && (
        <form className="flex flex-wrap gap-2 border-b border-border p-3" onSubmit={(e) => {
          e.preventDefault();
          if (!emp) return;
          start(async () => { const r = await assignSeatAction(licenseId, emp, account); if (!r.ok) toast.error(tc("error")); setEmp(""); setAccount(""); router.refresh(); });
        }}>
          <Select value={emp} onChange={(e) => setEmp(e.target.value)} className="min-w-48 flex-1"><option value="">—</option>{employees.filter((e) => !holders.has(e.id)).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</Select>
          <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder={t("fields.accountEmail")} className="min-w-48 flex-1" />
          <Button type="submit" variant="primary" disabled={!emp || pending}><UserPlus />{t("assign")}</Button>
        </form>
      )}
      {seats.length === 0 ? <EmptyState title={t("noHolders")} /> : (
        <ul className="divide-y divide-border">
          {seats.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
              <Avatar id={s.employee.id} firstName={s.employee.firstName} lastName={s.employee.lastName} size={28} />
              <div className="min-w-0 flex-1">
                <Link href={`/people/${s.employee.id}`} className="text-[13px] font-medium hover:underline">{s.employee.firstName} {s.employee.lastName}</Link>
                <div className="truncate text-xs text-fg-subtle">{s.accountEmail} · {fmtDate(s.assignedAt, locale)}</div>
              </div>
              {s.employee.status === "OFFBOARDED" || s.employee.status === "OFFBOARDING" ? <span className="rounded bg-danger-soft px-1.5 text-[10px] font-semibold text-danger">!</span> : null}
              {canWrite && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await revokeSeatAction(s.id); router.refresh(); })}><UserMinus />{t("revoke")}</Button>}
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className="border-t border-border p-3 text-end">
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => { if (confirm(t("deleteConfirm"))) start(async () => { await deleteLicenseAction(licenseId); router.push("/licenses"); router.refresh(); }); }}><Trash2 />{tc("delete")}</Button>
        </div>
      )}
    </Card>
  );
}
