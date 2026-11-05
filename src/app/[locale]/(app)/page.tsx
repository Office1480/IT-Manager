import { getTranslations, setRequestLocale } from "next-intl/server";
import { addDays, differenceInYears } from "date-fns";
import { Cake, FileWarning, PartyPopper, UserPlus, Users, Wallet } from "lucide-react";
import { Link } from "@/i18n/routing";
import { db } from "@/lib/db";
import { requireContext } from "@/server/context";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, StatCard } from "@/components/ui/misc";
import { fmtDate, fmtMoney } from "@/lib/format";

/** Prochaine occurrence (anniversaire) d'une date dans l'année courante ou suivante. */
function nextOccurrence(d: Date, now: Date) {
  const n = new Date(Date.UTC(now.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (n < new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))) n.setUTCFullYear(n.getUTCFullYear() + 1);
  return n;
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext();
  const t = await getTranslations("dashboard");
  const now = new Date();

  const [employees, expiring, activity, salaries] = await Promise.all([
    db.employee.findMany({
      where: { organizationId: ctx.orgId, deletedAt: null, status: { not: "OFFBOARDED" } },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, birthDate: true, startDate: true, seniorityDate: true, status: true, department: { select: { name: true, color: true } } },
    }),
    ctx.can("document.read.all")
      ? db.document.findMany({
          where: { organizationId: ctx.orgId, expiresAt: { lte: addDays(now, 60) }, employeeId: { not: null } },
          include: { employee: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { expiresAt: "asc" },
          take: 6,
        })
      : Promise.resolve([]),
    ctx.can("audit.read")
      ? db.auditLog.findMany({ where: { organizationId: ctx.orgId, action: { not: "document.view" } }, orderBy: { createdAt: "desc" }, take: 8 })
      : Promise.resolve([]),
    ctx.can("compensation.read")
      ? db.compensationEvent.findMany({
          where: { organizationId: ctx.orgId, baseSalary: { not: null }, effectiveDate: { lte: now }, employee: { deletedAt: null, status: { not: "OFFBOARDED" } } },
          orderBy: { effectiveDate: "desc" },
          select: { employeeId: true, baseSalary: true },
        })
      : Promise.resolve(null),
  ]);

  const active = employees.filter((e) => e.status === "ACTIVE").length;
  const onboarding = employees.filter((e) => e.status === "ONBOARDING").length;
  let payroll: number | null = null;
  if (salaries) {
    const seen = new Set<string>();
    payroll = 0;
    for (const s of salaries) if (!seen.has(s.employeeId)) { seen.add(s.employeeId); payroll += Number(s.baseSalary); }
  }

  const birthdays = employees
    .filter((e) => e.birthDate)
    .map((e) => ({ ...e, next: nextOccurrence(e.birthDate!, now) }))
    .filter((e) => e.next <= addDays(now, 30))
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, 5);

  const anniversaries = employees
    .filter((e) => e.seniorityDate ?? e.startDate)
    .map((e) => {
      const start = (e.seniorityDate ?? e.startDate)!;
      const next = nextOccurrence(start, now);
      return { ...e, next, years: differenceInYears(next, start) };
    })
    .filter((e) => e.years > 0 && e.next <= addDays(now, 45))
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, 5);

  const recent = employees
    .filter((e) => e.startDate)
    .sort((a, b) => b.startDate!.getTime() - a.startDate!.getTime())
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

  const PersonLine = ({ p, right }: { p: { id: string; firstName: string; lastName: string; jobTitle: string | null }; right: React.ReactNode }) => (
    <Link href={`/people/${p.id}`} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
      <Avatar id={p.id} firstName={p.firstName} lastName={p.lastName} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{p.firstName} {p.lastName}</div>
        <div className="truncate text-xs text-fg-subtle">{p.jobTitle ?? "—"}</div>
      </div>
      <div className="shrink-0 text-xs text-fg-muted tabular">{right}</div>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{t("greeting", { name: ctx.user.name.split(" ")[0] })}</h1>
        <p className="mt-1 text-[13px] text-fg-muted">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("headcount")} value={employees.length} sub={`${t("activeEmployees", { count: active })} · ${onboarding} ${t("onboarding")}`} icon={<Users />} />
        {payroll != null && <StatCard label={t("payroll")} value={fmtMoney(payroll, locale, ctx.org.currency)} sub={t("payrollSub")} icon={<Wallet />} tone="success" />}
        {ctx.can("document.read.all") && <StatCard label={t("documentsExpiring")} value={expiring.length} sub={t("within60")} icon={<FileWarning />} tone={expiring.length ? "warning" : "success"} />}
        <StatCard label={t("recentHires")} value={recent.filter((r) => r.startDate! > addDays(now, -90)).length} sub="90 j" icon={<UserPlus />} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title={t("byDepartment")} />
          <CardBody className="space-y-3">
            {byDep.map((d) => (
              <div key={d.name}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: d.color }} />{d.name}</span>
                  <span className="text-fg-muted tabular">{d.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                  <div className="h-full rounded-full" style={{ width: `${(d.count / maxDep) * 100}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><Cake className="size-4 text-fg-subtle" />{t("birthdays")}</span>} />
          <CardBody className="py-3">
            {birthdays.length ? birthdays.map((b) => <PersonLine key={b.id} p={b} right={fmtDate(b.next, locale, { day: "numeric", month: "short", year: undefined })} />) : <p className="py-4 text-center text-xs text-fg-subtle">—</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><PartyPopper className="size-4 text-fg-subtle" />{t("anniversaries")}</span>} />
          <CardBody className="py-3">
            {anniversaries.length ? anniversaries.map((b) => <PersonLine key={b.id} p={b} right={`${t("years", { count: b.years })} · ${fmtDate(b.next, locale, { day: "numeric", month: "short", year: undefined })}`} />) : <p className="py-4 text-center text-xs text-fg-subtle">—</p>}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {ctx.can("document.read.all") && (
          <Card>
            <CardHeader title={t("documentsExpiring")} description={t("within60")} />
            <CardBody className="py-3">
              {expiring.length ? (
                expiring.map((d) => (
                  <Link key={d.id} href={`/people/${d.employee!.id}?tab=documents`} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
                    <Avatar id={d.employee!.id} firstName={d.employee!.firstName} lastName={d.employee!.lastName} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{d.title}</div>
                      <div className="truncate text-xs text-fg-subtle">{d.employee!.firstName} {d.employee!.lastName}</div>
                    </div>
                    <span className={`text-xs tabular ${d.expiresAt! < now ? "text-danger" : "text-warning"}`}>{fmtDate(d.expiresAt, locale)}</span>
                  </Link>
                ))
              ) : <p className="py-4 text-center text-xs text-fg-subtle">—</p>}
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
    </div>
  );
}
