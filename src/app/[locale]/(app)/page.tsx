import { getTranslations, setRequestLocale } from "next-intl/server";
import { addDays, differenceInYears } from "date-fns";
import {
  AppWindow, Boxes, Cake, CalendarCheck2, CalendarPlus, FileWarning, Inbox, Laptop, ListChecks, PartyPopper, PenLine, Plane, ShieldAlert, UserPlus, Users, Wallet,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { db } from "@/lib/db";
import { lname } from "@/lib/i18n-json";
import { requireContext } from "@/server/context";
import { balanceViews } from "@/server/leave-view";
import { pendingForApprover } from "@/server/leave";
import { continuityRisks } from "@/server/projects";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, StatCard } from "@/components/ui/misc";
import { RiskPanel } from "@/components/projects/risk-panel";
import { fmtDate, fmtMoney } from "@/lib/format";
import { daysUntil } from "@/lib/utils";

function nextOccurrence(d: Date, now: Date) {
  const n = new Date(Date.UTC(now.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (n < new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))) n.setUTCFullYear(n.getUTCFullYear() + 1);
  return n;
}

type Person = { id: string; firstName: string; lastName: string; jobTitle: string | null };

function PersonLine({ p, right, href }: { p: Person; right: React.ReactNode; href?: string }) {
  return (
    <Link href={href ?? `/people/${p.id}`} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
      <Avatar id={p.id} firstName={p.firstName} lastName={p.lastName} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{p.firstName} {p.lastName}</div>
        <div className="truncate text-xs text-fg-subtle">{p.jobTitle ?? "—"}</div>
      </div>
      <div className="shrink-0 text-xs text-fg-muted tabular">{right}</div>
    </Link>
  );
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext();
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const tcl = await getTranslations("checklist");
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const in14 = addDays(today, 14);
  const isManagerish = ctx.can("leave.approve") || ctx.can("employee.write");

  const [employees, leaves, expiring, activity, salaries, approvals, risks, assets, licenses, checklists, doneCounts, mine] = await Promise.all([
    db.employee.findMany({
      where: { organizationId: ctx.orgId, deletedAt: null, status: { not: "OFFBOARDED" } },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, birthDate: true, startDate: true, seniorityDate: true, status: true, department: { select: { name: true, color: true } } },
    }),
    db.leaveRequest.findMany({
      where: { organizationId: ctx.orgId, status: "APPROVED", startDate: { lte: in14 }, endDate: { gte: today } },
      include: { leaveType: true, employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
      orderBy: { startDate: "asc" },
    }),
    ctx.can("document.read.all")
      ? db.document.findMany({ where: { organizationId: ctx.orgId, expiresAt: { lte: addDays(now, 60) }, employeeId: { not: null } }, include: { employee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { expiresAt: "asc" }, take: 6 })
      : Promise.resolve([]),
    ctx.can("audit.read") ? db.auditLog.findMany({ where: { organizationId: ctx.orgId, action: { not: "document.view" } }, orderBy: { createdAt: "desc" }, take: 8 }) : Promise.resolve([]),
    ctx.can("compensation.read")
      ? db.compensationEvent.findMany({ where: { organizationId: ctx.orgId, baseSalary: { not: null }, effectiveDate: { lte: now }, employee: { deletedAt: null, status: { not: "OFFBOARDED" } } }, orderBy: { effectiveDate: "desc" }, select: { employeeId: true, baseSalary: true } })
      : Promise.resolve(null),
    pendingForApprover(ctx),
    ctx.can("project.read") ? continuityRisks(ctx) : Promise.resolve([]),
    ctx.can("asset.read") ? db.asset.findMany({ where: { organizationId: ctx.orgId, status: { notIn: ["RETIRED", "LOST"] } }, select: { id: true, brand: true, model: true, assetTag: true, purchasePrice: true, currency: true, warrantyEndDate: true } }) : Promise.resolve([]),
    ctx.can("asset.read") ? db.license.findMany({ where: { organizationId: ctx.orgId }, include: { _count: { select: { seats: { where: { revokedAt: null } } } } } }) : Promise.resolve([]),
    ctx.can("employee.write")
      ? db.checklistTask.groupBy({ by: ["employeeId", "kind"], where: { organizationId: ctx.orgId, employee: { status: { in: ["ONBOARDING", "OFFBOARDING"] } } }, _count: { _all: true } })
      : Promise.resolve([]),
    ctx.can("employee.write")
      ? db.checklistTask.groupBy({ by: ["employeeId", "kind"], where: { organizationId: ctx.orgId, done: true, employee: { status: { in: ["ONBOARDING", "OFFBOARDING"] } } }, _count: { _all: true } })
      : Promise.resolve([]),
    ctx.employeeId
      ? Promise.all([balanceViews(ctx, ctx.employeeId, locale), db.assetAssignment.findMany({ where: { employeeId: ctx.employeeId, returnedAt: null }, select: { id: true, signedAt: true } })])
      : Promise.resolve(null),
  ]);

  let payroll: number | null = null;
  if (salaries) {
    const seen = new Set<string>();
    payroll = 0;
    for (const s of salaries) if (!seen.has(s.employeeId)) { seen.add(s.employeeId); payroll += Number(s.baseSalary); }
  }
  const todayIso = today.toISOString().slice(0, 10);
  const outToday = leaves.filter((l) => l.startDate.toISOString().slice(0, 10) <= todayIso && l.endDate.toISOString().slice(0, 10) >= todayIso && l.leaveType.code !== "REMOTE");
  const upcoming = leaves.filter((l) => l.startDate > today).slice(0, 6);
  const assetValue = assets.filter((a) => a.currency === ctx.org.currency).reduce((s, a) => s + Number(a.purchasePrice ?? 0), 0);
  const warranty = assets
    .filter((a) => { const d = daysUntil(a.warrantyEndDate); return d != null && d >= -30 && d <= 60; })
    .sort((a, b) => a.warrantyEndDate!.getTime() - b.warrantyEndDate!.getTime())
    .slice(0, 5);
  const saasByCur = new Map<string, number>();
  for (const l of licenses) saasByCur.set(l.currency, (saasByCur.get(l.currency) ?? 0) + (Number(l.costPerSeat ?? 0) * (l.seatsPurchased ?? l._count.seats)) / (l.billingCycle === "YEARLY" ? 12 : 1));

  const birthdays = employees.filter((e) => e.birthDate).map((e) => ({ ...e, next: nextOccurrence(e.birthDate!, now) })).filter((e) => e.next <= addDays(now, 30)).sort((a, b) => a.next.getTime() - b.next.getTime()).slice(0, 5);
  const anniversaries = employees
    .filter((e) => e.seniorityDate ?? e.startDate)
    .map((e) => { const s = (e.seniorityDate ?? e.startDate)!; const next = nextOccurrence(s, now); return { ...e, next, years: differenceInYears(next, s) }; })
    .filter((e) => e.years > 0 && e.next <= addDays(now, 45))
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, 5);
  const byDep = Object.values(
    employees.reduce<Record<string, { name: string; color: string; count: number }>>((acc, e) => {
      const k = e.department?.name ?? "—";
      acc[k] ??= { name: k, color: e.department?.color ?? "#a1a1aa", count: 0 };
      acc[k].count++;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);
  const maxDep = Math.max(1, ...byDep.map((d) => d.count));
  const empById = new Map(employees.map((e) => [e.id, e]));
  const transitions = checklists
    .map((c) => ({ ...c, done: doneCounts.find((d) => d.employeeId === c.employeeId && d.kind === c.kind)?._count._all ?? 0, emp: empById.get(c.employeeId) }))
    .filter((c) => c.emp);

  const vacation = mine?.[0].find((b) => b.code === "VACATION");
  const toSign = mine?.[1].filter((a) => !a.signedAt).length ?? 0;
  const presentPct = employees.length ? Math.round(((employees.length - outToday.length) / employees.length) * 100) : 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{t("greeting", { name: ctx.user.name.split(" ")[0] })}</h1>
          <p className="mt-1 text-[13px] text-fg-muted">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ctx.employeeId && <Button asChild><Link href="/leave"><CalendarPlus />{tn("leave")}</Link></Button>}
          {ctx.can("employee.write") && <Button asChild><Link href="/people/new"><UserPlus />{tn("people")}</Link></Button>}
          {ctx.can("asset.write") && <Button asChild><Link href="/assets/new"><Boxes />{tn("assets")}</Link></Button>}
        </div>
      </div>

      {mine && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href="/leave" className="flex items-center gap-4 rounded-xl border border-border bg-gradient-to-br from-accent-soft to-surface p-4 shadow-sm transition-shadow hover:shadow-md">
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-white"><CalendarCheck2 className="size-5" /></span>
            <div><div className="text-xs text-fg-muted">{t("myBalance")}</div><div className="text-2xl font-semibold tabular">{vacation ? vacation.available : "—"}</div></div>
          </Link>
          <Link href={`/people/${ctx.employeeId}?tab=equipment`} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
            <span className="flex size-11 items-center justify-center rounded-xl bg-info-soft text-info"><Laptop className="size-5" /></span>
            <div><div className="text-xs text-fg-muted">{t("myEquipment")}</div><div className="text-2xl font-semibold tabular">{mine[1].length}</div></div>
          </Link>
          <Link href={`/people/${ctx.employeeId}?tab=equipment`} className={`flex items-center gap-4 rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${toSign ? "border-warning/40 bg-warning-soft" : "border-border bg-surface"}`}>
            <span className={`flex size-11 items-center justify-center rounded-xl ${toSign ? "bg-warning text-white" : "bg-bg-subtle text-fg-subtle"}`}><PenLine className="size-5" /></span>
            <div><div className="text-xs text-fg-muted">{t("toSign")}</div><div className="text-2xl font-semibold tabular">{toSign}</div></div>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("headcount")} value={employees.length} sub={`${t("activeEmployees", { count: employees.filter((e) => e.status === "ACTIVE").length })} · ${employees.filter((e) => e.status === "ONBOARDING").length} ${t("onboarding")}`} icon={<Users />} />
        <StatCard label={t("leaveToday")} value={outToday.length} sub={`${presentPct} %`} icon={<Plane />} tone="info" />
        {isManagerish && <StatCard label={t("pendingApprovals")} value={approvals.length} icon={<Inbox />} tone={approvals.length ? "warning" : "success"} />}
        {ctx.can("project.read") && <StatCard label={t("risks")} value={risks.length} icon={<ShieldAlert />} tone={risks.length ? "danger" : "success"} />}
        {payroll != null && <StatCard label={t("payroll")} value={fmtMoney(payroll, locale, ctx.org.currency)} sub={t("payrollSub")} icon={<Wallet />} tone="success" />}
        {ctx.can("asset.read") && <StatCard label={t("assetsValue")} value={fmtMoney(assetValue, locale, ctx.org.currency)} sub={String(assets.length)} icon={<Boxes />} />}
        {ctx.can("asset.read") && <StatCard label={t("licensesCost")} value={[...saasByCur].map(([c, v]) => fmtMoney(v, locale, c)).join(" + ") || "—"} icon={<AppWindow />} tone="info" />}
        {ctx.can("document.read.all") && <StatCard label={t("documentsExpiring")} value={expiring.length} sub={t("within60")} icon={<FileWarning />} tone={expiring.length ? "warning" : "success"} />}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><Plane className="size-4 text-fg-subtle" />{t("leaveToday")}</span>} action={<Link href="/leave" className="text-xs text-accent hover:underline">→</Link>} />
          <CardBody className="py-3">
            {outToday.length ? outToday.map((l) => <PersonLine key={l.id} p={l.employee} href={`/people/${l.employee.id}?tab=leave`} right={<span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: l.leaveType.color }} />{lname(l.leaveType.names, locale)}</span>} />) : <p className="py-3 text-center text-xs text-fg-subtle">—</p>}
            {upcoming.length > 0 && (
              <>
                <div className="mb-1 mt-3 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{t("upcomingLeave")}</div>
                {upcoming.map((l) => <PersonLine key={l.id} p={l.employee} href={`/people/${l.employee.id}?tab=leave`} right={`${fmtDate(l.startDate, locale, { day: "numeric", month: "short", year: undefined })} → ${fmtDate(l.endDate, locale, { day: "numeric", month: "short", year: undefined })}`} />)}
              </>
            )}
          </CardBody>
        </Card>
        {ctx.can("project.read") && <RiskPanel risks={risks.slice(0, 6)} />}
        {ctx.can("asset.read") && (
          <Card>
            <CardHeader title={<span className="inline-flex items-center gap-1.5"><ShieldAlert className="size-4 text-fg-subtle" />{t("warrantySoon")}</span>} action={<Link href="/assets" className="text-xs text-accent hover:underline">→</Link>} />
            <CardBody className="py-3">
              {warranty.length ? warranty.map((a) => {
                const d = daysUntil(a.warrantyEndDate)!;
                return (
                  <Link key={a.id} href={`/assets/${a.id}`} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-bg-subtle text-fg-subtle"><Laptop className="size-3.5" /></span>
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{a.brand} {a.model}</div><div className="text-xs text-fg-subtle">{a.assetTag}</div></div>
                    <Badge tone={d < 0 ? "danger" : "warning"}>{d < 0 ? "✕" : `${d} j`}</Badge>
                  </Link>
                );
              }) : <p className="py-3 text-center text-xs text-fg-subtle">—</p>}
            </CardBody>
          </Card>
        )}
      </div>

      {transitions.length > 0 && (
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><ListChecks className="size-4 text-fg-subtle" />{tcl("inProgress")}</span>} />
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {transitions.map((c) => {
              const pct = Math.round((c.done / c._count._all) * 100);
              return (
                <Link key={c.employeeId + c.kind} href={`/people/${c.employeeId}`} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-hover">
                  <Avatar id={c.emp!.id} firstName={c.emp!.firstName} lastName={c.emp!.lastName} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px] font-medium">{c.emp!.firstName} {c.emp!.lastName}<Badge tone={c.kind === "ONBOARDING" ? "info" : "warning"}>{tcl(c.kind === "ONBOARDING" ? "onboarding" : "offboarding")}</Badge></div>
                    <div className="mt-1.5 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-subtle"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div><span className="text-[11px] tabular text-fg-subtle">{c.done}/{c._count._all}</span></div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title={t("byDepartment")} />
          <CardBody className="space-y-3">
            {byDep.map((d) => (
              <div key={d.name}>
                <div className="mb-1 flex items-center justify-between text-[13px]"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: d.color }} />{d.name}</span><span className="text-fg-muted tabular">{d.count}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle"><div className="h-full rounded-full" style={{ width: `${(d.count / maxDep) * 100}%`, background: d.color }} /></div>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><Cake className="size-4 text-fg-subtle" />{t("birthdays")}</span>} />
          <CardBody className="py-3">{birthdays.length ? birthdays.map((b) => <PersonLine key={b.id} p={b} right={fmtDate(b.next, locale, { day: "numeric", month: "short", year: undefined })} />) : <p className="py-4 text-center text-xs text-fg-subtle">—</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><PartyPopper className="size-4 text-fg-subtle" />{t("anniversaries")}</span>} />
          <CardBody className="py-3">{anniversaries.length ? anniversaries.map((b) => <PersonLine key={b.id} p={b} right={`${t("years", { count: b.years })} · ${fmtDate(b.next, locale, { day: "numeric", month: "short", year: undefined })}`} />) : <p className="py-4 text-center text-xs text-fg-subtle">—</p>}</CardBody>
        </Card>
      </div>

      {(ctx.can("document.read.all") || ctx.can("audit.read")) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {ctx.can("document.read.all") && (
            <Card>
              <CardHeader title={t("documentsExpiring")} description={t("within60")} />
              <CardBody className="py-3">
                {expiring.length ? expiring.map((d) => (
                  <Link key={d.id} href={`/people/${d.employee!.id}?tab=documents`} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
                    <Avatar id={d.employee!.id} firstName={d.employee!.firstName} lastName={d.employee!.lastName} size={28} />
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{d.title}</div><div className="truncate text-xs text-fg-subtle">{d.employee!.firstName} {d.employee!.lastName}</div></div>
                    <span className={`text-xs tabular ${d.expiresAt! < now ? "text-danger" : "text-warning"}`}>{fmtDate(d.expiresAt, locale)}</span>
                  </Link>
                )) : <p className="py-4 text-center text-xs text-fg-subtle">—</p>}
              </CardBody>
            </Card>
          )}
          {ctx.can("audit.read") && (
            <Card>
              <CardHeader title={t("activity")} action={<Link href="/audit" className="text-xs text-accent hover:underline">→</Link>} />
              {activity.length ? (
                <ul className="divide-y divide-border">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                      <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                      <span className="font-medium">{a.actorName}</span>
                      <span className="truncate text-fg-muted">{a.action}</span>
                      <span className="ms-auto shrink-0 text-xs text-fg-subtle tabular">{fmtDate(a.createdAt, locale, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}</span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title={t("noActivity")} />}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
