import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { lname } from "@/lib/i18n-json";
import { ensureOrgSetup } from "@/server/setup";
import { requireContext } from "@/server/context";
import { PageHeader } from "@/components/ui/misc";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlTabs } from "@/components/ui/url-tabs";
import { DepartmentsPanel, GeneralForm, HolidaysPanel, JiraPanel, LeaveTypesPanel, UsersPanel } from "@/components/settings/settings-forms";

export async function generateMetadata() {
  return { title: (await getTranslations("settings"))("title") };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("settings.manage");
  await ensureOrgSetup(ctx.orgId);
  const t = await getTranslations("settings");
  const [members, employees, types, hols, deps] = await Promise.all([
    db.membership.findMany({ where: { organizationId: ctx.orgId }, include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true } } }, orderBy: { createdAt: "asc" } }),
    db.employee.findMany({ where: { organizationId: ctx.orgId, deletedAt: null }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
    db.leaveType.findMany({ where: { organizationId: ctx.orgId }, orderBy: { position: "asc" } }),
    db.holiday.findMany({ where: { organizationId: ctx.orgId }, orderBy: { date: "asc" } }),
    db.department.findMany({ where: { organizationId: ctx.orgId }, orderBy: { name: "asc" }, include: { _count: { select: { employees: { where: { deletedAt: null } } } } } }),
  ]);
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <UrlTabs defaultValue="general">
        <TabsList className="overflow-x-auto scrollbar-thin">
          {(["general", "users", "leave", "holidays", "departments", "integrations"] as const).map((k) => <TabsTrigger key={k} value={k}>{t(`tabs.${k}`)}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="general"><GeneralForm org={ctx.org} /></TabsContent>
        <TabsContent value="users"><UsersPanel members={members} employees={employees} meUserId={ctx.userId} isOwner={ctx.role === "OWNER"} /></TabsContent>
        <TabsContent value="leave">
          <LeaveTypesPanel types={types.map((x) => ({ id: x.id, name: lname(x.names, locale), code: x.code, color: x.color, active: x.active, paid: x.paid, requiresApproval: x.requiresApproval, tracksBalance: x.tracksBalance, accrualPerMonth: x.accrualPerMonth == null ? null : Number(x.accrualPerMonth), statutory: x.statutory }))} />
        </TabsContent>
        <TabsContent value="holidays"><HolidaysPanel holidays={hols.map((h) => ({ id: h.id, date: h.date, kind: h.kind, name: lname(h.names, locale) }))} /></TabsContent>
        <TabsContent value="departments"><DepartmentsPanel departments={deps.map((d) => ({ id: d.id, name: d.name, color: d.color, count: d._count.employees }))} /></TabsContent>
        <TabsContent value="integrations">
          <JiraPanel jira={{ baseUrl: ctx.org.jiraBaseUrl, email: ctx.org.jiraEmail, hasToken: !!ctx.org.jiraTokenEnc, defaultProject: ctx.org.jiraDefaultProject, issueType: ctx.org.jiraIssueType }} />
        </TabsContent>
      </UrlTabs>
    </>
  );
}
