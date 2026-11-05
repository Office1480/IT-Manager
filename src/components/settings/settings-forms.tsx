"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, KeyRound, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { useRouter } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/misc";
import {
  addHolidayAction, createAccessAction, deleteDepartmentAction, deleteHolidayAction, removeMemberAction, resetPasswordAction,
  saveDepartmentAction, saveJiraAction, testJiraAction, updateLeaveTypeAction, updateMemberAction, updateOrgAction,
} from "@/server/phase5-actions";
import { fmtDate } from "@/lib/format";
import { colorFor } from "@/lib/utils";

const useRun = () => {
  const router = useRouter();
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error && r.error.length < 80 ? r.error : tc("error"));
      if (success) toast.success(success);
      router.refresh();
    });
  return { pending, run };
};

export function GeneralForm({ org }: { org: { name: string; currency: string; locale: string; workDays: number[] } }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { pending, run } = useRun();
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ d, label: new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + d))) }));
  return (
    <Card>
      <CardHeader title={t("tabs.general")} />
      <CardBody>
        <form className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => updateOrgAction(fd), tc("saved")); }}>
          <Field label={t("orgName")} className="sm:col-span-2"><Input name="name" defaultValue={org.name} /></Field>
          <Field label={t("currency")}><Select name="currency" defaultValue={org.currency}>{["ILS", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label={t("defaultLocale")}><Select name="locale" defaultValue={org.locale}><option value="fr">Français</option><option value="en">English</option><option value="he">עברית</option></Select></Field>
          <Field label={t("workDays")} className="sm:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {days.map(({ d, label }) => (
                <label key={d} className="cursor-pointer">
                  <input type="checkbox" name="workDays" value={d} defaultChecked={org.workDays.includes(d)} className="peer sr-only" />
                  <span className="inline-flex h-8 min-w-12 items-center justify-center rounded-lg border border-border px-2 text-xs font-medium text-fg-muted peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent">{label}</span>
                </label>
              ))}
            </div>
          </Field>
          <div className="sm:col-span-2"><Button type="submit" variant="primary" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{tc("save")}</Button></div>
        </form>
      </CardBody>
    </Card>
  );
}

type Member = { id: string; role: Role; user: { id: string; name: string; email: string; lastLoginAt: Date | null }; employeeId: string | null };

export function UsersPanel({ members, employees, meUserId, isOwner }: { members: Member[]; employees: { id: string; firstName: string; lastName: string }[]; meUserId: string; isOwner: boolean }) {
  const t = useTranslations("settings.users");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const roles: Role[] = isOwner ? ["OWNER", "ADMIN", "HR", "MANAGER", "EMPLOYEE"] : ["ADMIN", "HR", "MANAGER", "EMPLOYEE"];
  const linked = new Set(members.map((m) => m.employeeId).filter(Boolean));
  return (
    <Card>
      <CardHeader title={useTranslations("settings.tabs")("users")} description={t("roleHelp")} action={<Button size="sm" variant="primary" onClick={() => { setCreated(null); setOpen(true); }}><UserPlus />{t("invite")}</Button>} />
      <Table>
        <thead><tr><Th>{t("name")}</Th><Th>{t("role")}</Th><Th className="hidden md:table-cell">{t("employee")}</Th><Th className="hidden md:table-cell">{t("lastLogin")}</Th><Th /></tr></thead>
        <tbody>
          {members.map((m) => {
            const self = m.user.id === meUserId;
            return (
              <tr key={m.id}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: colorFor(m.user.email) }}>{m.user.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>
                    <div><div className="font-medium">{m.user.name} {self && <Badge tone="accent">{t("self")}</Badge>}</div><div className="text-xs text-fg-subtle">{m.user.email}</div></div>
                  </div>
                </Td>
                <Td>
                  <Select defaultValue={m.role} disabled={self || pending || (m.role === "OWNER" && !isOwner)} className="w-36" onChange={(e) => run(() => updateMemberAction(m.id, e.target.value as Role, m.employeeId), tc("saved"))}>
                    {(m.role === "OWNER" && !isOwner ? ["OWNER" as Role] : roles).map((r) => <option key={r} value={r}>{tr(r)}</option>)}
                  </Select>
                </Td>
                <Td className="hidden md:table-cell">
                  <Select defaultValue={m.employeeId ?? ""} disabled={pending} className="w-44" onChange={(e) => run(() => updateMemberAction(m.id, m.role, e.target.value || null), tc("saved"))}>
                    <option value="">—</option>
                    {employees.filter((e) => e.id === m.employeeId || !linked.has(e.id)).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                  </Select>
                </Td>
                <Td className="hidden text-fg-muted md:table-cell">{m.user.lastLoginAt ? fmtDate(m.user.lastLoginAt, locale) : t("never")}</Td>
                <Td className="text-end">
                  {!self && (
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title={t("resetPassword")} disabled={pending} onClick={() => run(async () => { const r = await resetPasswordAction(m.id); if (r.ok) prompt(t("passwordReset", { password: r.data!.password }), r.data!.password); return r; })}><KeyRound /></Button>
                      <Button size="icon" variant="ghost" className="text-danger" title={t("remove")} disabled={pending} onClick={() => confirm(t("removeConfirm")) && run(() => removeMemberAction(m.id))}><Trash2 /></Button>
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("invite")}>
          {created ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-success"><Check className="size-5" />{t("created")}</div>
              <Field label={t("password")}><Input readOnly value={created} className="font-mono" onFocus={(e) => e.target.select()} /></Field>
              <div className="flex justify-end"><Button onClick={() => setOpen(false)}>OK</Button></div>
            </div>
          ) : (
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(async () => { const r = await createAccessAction(fd); if (r.ok) setCreated(r.data!.password); else if (r.fieldErrors) toast.error(Object.values(r.fieldErrors)[0]); return r.ok ? r : { ok: true }; });
            }}>
              <Field label={t("employee")} className="sm:col-span-2">
                <Select name="employeeId"><option value="">—</option>{employees.filter((e) => !linked.has(e.id)).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</Select>
              </Field>
              <Field label={t("email")} required><Input name="email" type="email" required /></Field>
              <Field label={t("name")}><Input name="name" /></Field>
              <Field label={t("role")}><Select name="role" defaultValue="EMPLOYEE">{roles.map((r) => <option key={r} value={r}>{tr(r)}</option>)}</Select></Field>
              <Field label={t("password")} hint={tc("optional")}><Input name="password" type="text" minLength={8} /></Field>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
                <Button type="submit" variant="primary" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{tc("create")}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

type LT = { id: string; name: string; code: string; color: string; active: boolean; paid: boolean; requiresApproval: boolean; tracksBalance: boolean; accrualPerMonth: number | null; statutory: boolean };

export function LeaveTypesPanel({ types }: { types: LT[] }) {
  const t = useTranslations("settings.leaveTypes");
  const tc = useTranslations("common");
  const { pending, run } = useRun();
  return (
    <Card>
      <CardHeader title={useTranslations("settings.tabs")("leave")} />
      <ul className="divide-y divide-border">
        {types.map((ty) => (
          <li key={ty.id}>
            <form className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3" onChange={(e) => { const fd = new FormData(e.currentTarget); run(() => updateLeaveTypeAction(ty.id, fd), tc("saved")); }} onSubmit={(e) => e.preventDefault()}>
              <input type="color" name="color" defaultValue={ty.color} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" />
              <div className="min-w-44 flex-1"><div className="text-[13px] font-medium">{ty.name}</div><div className="font-mono text-[11px] text-fg-subtle">{ty.code} {ty.statutory && <Badge tone="info">{t("statutory")}</Badge>}</div></div>
              {(["active", "paid", "requiresApproval"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1.5 text-xs text-fg-muted"><input type="checkbox" name={k} defaultChecked={ty[k]} disabled={pending} className="accent-[var(--accent)]" />{t(k === "requiresApproval" ? "approval" : k)}</label>
              ))}
              {ty.tracksBalance && ty.code === "VACATION" && (
                <label className="flex items-center gap-1.5 text-xs text-fg-muted">{t("accrual")}<Input name="accrualPerMonth" type="number" step="0.01" min={0} defaultValue={ty.accrualPerMonth ?? ""} className="h-7 w-20" onBlur={(e) => e.currentTarget.form?.dispatchEvent(new Event("change", { bubbles: true }))} /></label>
              )}
            </form>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function HolidaysPanel({ holidays }: { holidays: { id: string; date: Date; name: string; kind: "HOLIDAY" | "EVE" }[] }) {
  const t = useTranslations("settings.holidays");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { pending, run } = useRun();
  const years = [...new Set(holidays.map((h) => h.date.getUTCFullYear()))];
  return (
    <Card>
      <CardHeader title={useTranslations("settings.tabs")("holidays")} description={t("hint")} />
      <form className="flex flex-wrap items-end gap-2 border-b border-border p-3" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); e.currentTarget.reset(); run(() => addHolidayAction(fd), tc("created")); }}>
        <Field label={t("date")}><Input name="date" type="date" required /></Field>
        <Field label={t("name")} className="min-w-48 flex-1"><Input name="name" required /></Field>
        <Field label={t("kind")}><Select name="kind">{(["HOLIDAY", "EVE"] as const).map((k) => <option key={k} value={k}>{t(k)}</option>)}</Select></Field>
        <Button type="submit" variant="primary" disabled={pending}><Plus />{t("add")}</Button>
      </form>
      {years.map((y) => (
        <div key={y}>
          <div className="bg-bg-subtle px-5 py-1.5 text-xs font-semibold text-fg-muted">{y}</div>
          <ul className="divide-y divide-border">
            {holidays.filter((h) => h.date.getUTCFullYear() === y).map((h) => (
              <li key={h.id} className="group flex items-center gap-3 px-5 py-2">
                <span className="w-32 text-[13px] tabular text-fg-muted">{fmtDate(h.date, locale, { weekday: "short", day: "numeric", month: "short", year: undefined })}</span>
                <span className="flex-1 text-[13px]">{h.name}</span>
                <Badge tone={h.kind === "HOLIDAY" ? "danger" : "warning"}>{t(h.kind)}</Badge>
                <button onClick={() => run(() => deleteHolidayAction(h.id))} className="text-fg-subtle opacity-0 hover:text-danger group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}

export function DepartmentsPanel({ departments }: { departments: { id: string; name: string; color: string; count: number }[] }) {
  const t = useTranslations("settings.departments");
  const tc = useTranslations("common");
  const { pending, run } = useRun();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  return (
    <Card>
      <CardHeader title={useTranslations("settings.tabs")("departments")} />
      <form className="flex gap-2 border-b border-border p-3" onSubmit={(e) => { e.preventDefault(); run(() => saveDepartmentAction(null, name, color), tc("created")); setName(""); }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name")} />
        <Button type="submit" variant="primary" disabled={pending || !name.trim()}><Plus />{t("add")}</Button>
      </form>
      <ul className="divide-y divide-border">
        {departments.map((d) => (
          <li key={d.id} className="group flex items-center gap-3 px-5 py-2.5">
            <input type="color" defaultValue={d.color} onBlur={(e) => e.target.value !== d.color && run(() => saveDepartmentAction(d.id, d.name, e.target.value), tc("saved"))} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" />
            <Input defaultValue={d.name} className="h-7 max-w-64 border-transparent shadow-none hover:border-border" onBlur={(e) => e.target.value !== d.name && run(() => saveDepartmentAction(d.id, e.target.value, d.color), tc("saved"))} />
            <span className="ms-auto text-xs text-fg-subtle">{d.count} {t("members").toLowerCase()}</span>
            <button onClick={() => confirm(t("deleteConfirm")) && run(() => deleteDepartmentAction(d.id))} className="text-fg-subtle opacity-0 hover:text-danger group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function JiraPanel({ jira }: { jira: { baseUrl: string | null; email: string | null; hasToken: boolean; defaultProject: string | null; issueType: string | null } }) {
  const t = useTranslations("settings.jira");
  const tc = useTranslations("common");
  const { pending, run } = useRun();
  const configured = !!(jira.baseUrl && jira.email && jira.hasToken);
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><span className="flex size-5 items-center justify-center rounded bg-[#2684ff] text-[10px] font-bold text-white">J</span>{t("title")}</span>} description={t("hint")} action={<Badge tone={configured ? "success" : "neutral"} dot>{configured ? t("configured") : t("notConfigured")}</Badge>} />
      <CardBody>
        <form className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => saveJiraAction(fd), tc("saved")); }}>
          <Field label={t("baseUrl")} className="sm:col-span-2"><Input name="baseUrl" defaultValue={jira.baseUrl ?? ""} placeholder="https://votre-entreprise.atlassian.net" /></Field>
          <Field label={t("email")}><Input name="email" type="email" defaultValue={jira.email ?? ""} /></Field>
          <Field label={t("token")} hint={jira.hasToken ? t("tokenSet") : undefined}><Input name="token" type="password" autoComplete="off" /></Field>
          <Field label={t("defaultProject")}><Input name="defaultProject" defaultValue={jira.defaultProject ?? ""} className="uppercase" /></Field>
          <Field label={t("issueType")}><Select name="issueType" defaultValue={jira.issueType ?? "Epic"}>{["Epic", "Story", "Task"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={pending}>{tc("save")}</Button>
            {configured && <Button type="button" disabled={pending} onClick={() => run(async () => { const r = await testJiraAction(); if (r.ok) toast.success(`${t("ok")} — ${r.data!.name}`); return r; })}>{t("test")}</Button>}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
