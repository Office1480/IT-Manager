import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plane } from "lucide-react";
import { db } from "@/lib/db";
import { lname } from "@/lib/i18n-json";
import { ensureOrgSetup } from "@/server/setup";
import { requireContext, teamEmployeeIds } from "@/server/context";
import { holidays, requestsInRange } from "@/server/leave";
import { approvalRows, balanceViews, requestRows, typeOptions } from "@/server/leave-view";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/routing";
import { TeamCalendar } from "@/components/leave/team-calendar";
import { LeaveRequestDialog } from "@/components/leave/leave-request-dialog";
import { Approvals } from "@/components/leave/approvals";
import { RequestsList } from "@/components/leave/requests-list";
import { BalanceCards } from "@/components/leave/balance-cards";

export async function generateMetadata() {
  return { title: (await getTranslations("leave"))("title") };
}

export default async function LeavePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ month?: string; span?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("leave.read.all");
  await ensureOrgSetup(ctx.orgId);
  const t = await getTranslations("leave");
  const sp = await searchParams;

  const now = new Date();
  const todayIso = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
  const m = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : todayIso.slice(0, 7);
  const span = sp.span === "3" ? 3 : 1;
  const from = new Date(`${m}-01T00:00:00Z`);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + span, 0));
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  const [people, leaves, hols, types, approvals] = await Promise.all([
    db.employee.findMany({
      where: { organizationId: ctx.orgId, deletedAt: null, status: { not: "OFFBOARDED" } },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { id: true, name: true, color: true } } },
      orderBy: [{ firstName: "asc" }],
    }),
    requestsInRange(ctx, from, to),
    holidays(ctx.orgId, from, to),
    typeOptions(ctx, locale),
    approvalRows(ctx, locale),
  ]);

  const me = ctx.employeeId;
  const [balances, mine] = me ? await Promise.all([balanceViews(ctx, me, locale), requestRows(ctx, me, locale)]) : [[], []];
  const managerTeam = ctx.role === "MANAGER" ? new Set(await teamEmployeeIds(ctx)) : null;
  const requestFor = ctx.can("leave.configure") ? people : managerTeam ? people.filter((p) => p.id === me || managerTeam.has(p.id)) : undefined;

  const outToday = leaves.filter((l) => l.status === "APPROVED" && l.startDate.toISOString().slice(0, 10) <= todayIso && l.endDate.toISOString().slice(0, 10) >= todayIso);
  const peopleById = new Map(people.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={(me || requestFor) && <LeaveRequestDialog types={types} balances={Object.fromEntries(balances.map((b) => [b.code, b.available]))} employees={requestFor} defaultEmployeeId={me} />}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium"><Plane className="size-4 text-fg-subtle" />{t("outToday")}</span>
        {outToday.length === 0 ? (
          <span className="text-[13px] text-fg-subtle">{t("nobodyOut")}</span>
        ) : (
          outToday.map((l) => {
            const p = peopleById.get(l.employeeId);
            if (!p) return null;
            return (
              <Link key={l.id} href={`/people/${p.id}?tab=leave`} className="inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pe-2.5 ps-0.5 text-xs hover:bg-surface-hover">
                <Avatar id={p.id} firstName={p.firstName} lastName={p.lastName} size={20} />
                {p.firstName} {p.lastName.charAt(0)}.
                <span className="size-1.5 rounded-full" style={{ background: l.leaveType.color }} title={lname(l.leaveType.names, locale)} />
              </Link>
            );
          })
        )}
      </div>

      <TeamCalendar
        from={from.toISOString().slice(0, 10)}
        days={days}
        span={span as 1 | 3}
        today={todayIso}
        workDays={ctx.org.workDays}
        people={people}
        types={types.map((x) => ({ name: x.name, color: x.color }))}
        holidays={hols.map((h) => ({ date: h.date.toISOString().slice(0, 10), kind: h.kind, name: lname(h.names, locale) }))}
        leaves={leaves.map((l) => ({
          id: l.id, employeeId: l.employeeId, start: l.startDate.toISOString().slice(0, 10), end: l.endDate.toISOString().slice(0, 10),
          startHalf: l.startHalf, endHalf: l.endHalf, status: l.status as "PENDING" | "APPROVED", typeName: lname(l.leaveType.names, locale), color: l.leaveType.color, days: Number(l.days),
        }))}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {ctx.can("leave.approve") && <Approvals rows={approvals} />}
        {me && (
          <div className="space-y-5">
            {balances.length > 0 && (
              <div>
                <h2 className="mb-3 text-[13px] font-semibold">{t("balances")}</h2>
                <BalanceCards balances={balances} />
              </div>
            )}
            <Card>
              <CardHeader title={t("myRequests")} />
              <RequestsList rows={mine} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
