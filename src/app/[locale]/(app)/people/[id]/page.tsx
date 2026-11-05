import { getTranslations, setRequestLocale } from "next-intl/server";
import { differenceInYears, differenceInMonths } from "date-fns";
import { Briefcase, CalendarDays, FileText, FolderKanban, Laptop, Lock, Mail, MapPin, Phone, TrendingUp, UserRound } from "lucide-react";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { canSeeDocuments, getEmployee, listCompensation, listDocuments } from "@/server/employees";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescList, EmptyState } from "@/components/ui/misc";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlTabs } from "@/components/ui/url-tabs";
import { Secret } from "@/components/ui/secret";
import { EmployeeStatusBadge } from "@/components/people/status-badge";
import { EmployeeActionsMenu } from "@/components/people/employee-actions-menu";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { CompensationPanel } from "@/components/people/compensation-panel";
import { fmtDate } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const e = await getEmployee(ctx, (await params).id);
  return { title: `${e.firstName} ${e.lastName}` };
}

export default async function EmployeePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("employee.read.all");
  const t = await getTranslations();
  const e = await getEmployee(ctx, id);
  const showDocs = await canSeeDocuments(ctx, id);
  const showComp = ctx.can("compensation.read") || e.self;
  const [docs, comp] = await Promise.all([showDocs ? listDocuments(ctx, { employeeId: id }) : [], showComp ? listCompensation(ctx, id) : []]);

  const now = new Date();
  const since = e.seniorityDate ?? e.startDate;
  const months = since ? differenceInMonths(now, since) : null;
  const seniority = months == null ? "—" : months >= 12 ? t("dashboard.years", { count: Math.floor(months / 12) }) : `${months} m`;
  const pct = (v: unknown) => (v == null ? "—" : `${Number(v)} %`);

  return (
    <div className="space-y-6">
      <div className="text-xs text-fg-subtle">
        <Link href="/people" className="hover:text-fg">{t("people.title")}</Link>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Avatar id={e.id} firstName={e.firstName} lastName={e.lastName} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">{e.firstName} {e.lastName}</h1>
            {(e.firstNameHe || e.lastNameHe) && <span dir="rtl" className="text-[15px] text-fg-subtle">{e.firstNameHe} {e.lastNameHe}</span>}
            <EmployeeStatusBadge status={e.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-muted">
            {e.jobTitle && <span className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5 text-fg-subtle" />{e.jobTitle}</span>}
            {e.department && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: e.department.color }} />
                {e.department.name}
              </span>
            )}
            <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1.5 hover:text-fg"><Mail className="size-3.5 text-fg-subtle" />{e.email}</a>
            {e.phone && <a href={`tel:${e.phone}`} className="inline-flex items-center gap-1.5 hover:text-fg"><Phone className="size-3.5 text-fg-subtle" />{e.phone}</a>}
            {e.workLocation && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-fg-subtle" />{e.workLocation}</span>}
          </div>
        </div>
        {ctx.can("employee.write") && <EmployeeActionsMenu id={e.id} />}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: t("people.fields.startDate"), value: fmtDate(e.startDate, locale) },
          { label: t("people.seniority"), value: seniority },
          { label: t("people.fields.contractType"), value: `${t(`people.contract.${e.contractType}`)} · ${e.workPercentage}%` },
          { label: t("people.reportsTo"), value: e.manager ? <Link href={`/people/${e.manager.id}`} className="hover:underline">{e.manager.firstName} {e.manager.lastName}</Link> : "—" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
            <div className="text-xs text-fg-subtle">{k.label}</div>
            <div className="mt-1 truncate text-[14px] font-medium">{k.value}</div>
          </div>
        ))}
      </div>

      <UrlTabs defaultValue="overview">
        <TabsList className="overflow-x-auto scrollbar-thin">
          <TabsTrigger value="overview"><UserRound />{t("people.tabs.overview")}</TabsTrigger>
          {showDocs && <TabsTrigger value="documents"><FileText />{t("people.tabs.documents")}<span className="text-xs text-fg-subtle">{docs.length}</span></TabsTrigger>}
          {showComp && <TabsTrigger value="compensation"><TrendingUp />{t("people.tabs.compensation")}</TabsTrigger>}
          <TabsTrigger value="equipment"><Laptop />{t("people.tabs.equipment")}</TabsTrigger>
          <TabsTrigger value="leave"><CalendarDays />{t("people.tabs.leave")}</TabsTrigger>
          <TabsTrigger value="projects"><FolderKanban />{t("people.tabs.projects")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <Card>
                <CardHeader title={t("people.sections.identity")} />
                <CardBody>
                  <DescList
                    items={[
                      { label: t("people.fields.employeeNumber"), value: e.employeeNumber },
                      { label: t("people.fields.birthDate"), value: e.birthDate ? `${fmtDate(e.birthDate, locale)} · ${t("people.age", { count: differenceInYears(now, e.birthDate) })}` : "—" },
                      { label: t("people.fields.gender"), value: e.gender ? t(`people.gender.${e.gender}`) : "—" },
                      { label: t("people.fields.maritalStatus"), value: e.maritalStatus ? t(`people.marital.${e.maritalStatus}`) : "—" },
                      { label: t("people.fields.childrenCount"), value: e.childrenCount ?? "—" },
                      { label: t("people.fields.nationality"), value: e.nationality ?? "—" },
                      { label: t("people.fields.nationalId"), value: e.sensitiveVisible ? <Secret value={e.nationalId} /> : e.nationalIdLast4 ? `•••••${e.nationalIdLast4}` : "—" },
                      ...(e.sensitiveVisible ? [{ label: t("people.fields.passport"), value: <Secret value={e.passport} /> }] : []),
                    ]}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t("people.sections.contact")} />
                <CardBody>
                  <DescList
                    items={[
                      { label: t("people.fields.personalEmail"), value: e.personalEmail ?? "—" },
                      { label: t("people.fields.phone"), value: e.phone ?? "—" },
                      { label: t("people.fields.addressStreet"), value: [e.addressStreet, e.addressZip, e.addressCity, e.addressCountry].filter(Boolean).join(", ") || "—" },
                      { label: t("people.sections.emergency"), value: e.emergencyName ? `${e.emergencyName}${e.emergencyRelation ? ` (${e.emergencyRelation})` : ""} · ${e.emergencyPhone ?? ""}` : "—" },
                    ]}
                  />
                </CardBody>
              </Card>
              {e.sensitiveVisible ? (
                <Card>
                  <CardHeader title={`${t("people.sections.bank")} & ${t("people.sections.benefits")}`} description={<span className="inline-flex items-center gap-1"><Lock className="size-3" />{t("people.sensitiveHint")}</span>} />
                  <CardBody>
                    <DescList
                      items={[
                        { label: t("people.fields.bankName"), value: [e.bankName, e.bankBranch].filter(Boolean).join(" · ") || "—" },
                        { label: t("people.fields.bankAccount"), value: <Secret value={e.bankAccount} /> },
                        { label: t("people.fields.pensionFund"), value: e.pensionFund ?? "—" },
                        { label: `${t("people.fields.pensionEmployeeRate")} / ${t("people.fields.pensionEmployerRate")}`, value: `${pct(e.pensionEmployeeRate)} / ${pct(e.pensionEmployerRate)}` },
                        { label: t("people.fields.severanceRate"), value: pct(e.severanceRate) },
                        { label: t("people.fields.kerenHishtalmut"), value: e.kerenHishtalmut ? `${pct(e.kerenEmployeeRate)} / ${pct(e.kerenEmployerRate)}` : t("common.no") },
                      ]}
                    />
                  </CardBody>
                </Card>
              ) : null}
              {e.notes && ctx.can("employee.write") && (
                <Card>
                  <CardHeader title={t("people.sections.notes")} />
                  <CardBody className="whitespace-pre-wrap text-[13px] text-fg-muted">{e.notes}</CardBody>
                </Card>
              )}
            </div>
            <div className="space-y-5">
              <Card>
                <CardHeader title={t("people.reportsTo")} />
                <CardBody className="py-3">
                  {e.manager ? (
                    <Link href={`/people/${e.manager.id}`} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
                      <Avatar id={e.manager.id} firstName={e.manager.firstName} lastName={e.manager.lastName} size={32} />
                      <div><div className="text-[13px] font-medium">{e.manager.firstName} {e.manager.lastName}</div><div className="text-xs text-fg-subtle">{e.manager.jobTitle}</div></div>
                    </Link>
                  ) : <span className="text-[13px] text-fg-subtle">—</span>}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t("people.directReports")} description={String(e.reports.length)} />
                <CardBody className="py-3">
                  {e.reports.length ? (
                    <ul className="space-y-0.5">
                      {e.reports.map((r) => (
                        <li key={r.id}>
                          <Link href={`/people/${r.id}`} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
                            <Avatar id={r.id} firstName={r.firstName} lastName={r.lastName} size={28} />
                            <div className="min-w-0"><div className="truncate text-[13px] font-medium">{r.firstName} {r.lastName}</div><div className="truncate text-xs text-fg-subtle">{r.jobTitle}</div></div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <span className="text-[13px] text-fg-subtle">{t("people.noReports")}</span>}
                </CardBody>
              </Card>
            </div>
          </div>
        </TabsContent>

        {showDocs && (
          <TabsContent value="documents">
            <DocumentsPanel docs={docs} employeeId={e.id} canWrite={ctx.can("document.write")} />
          </TabsContent>
        )}

        {showComp && (
          <TabsContent value="compensation">
            <CompensationPanel
              employeeId={e.id}
              canWrite={ctx.can("compensation.write")}
              currency={ctx.org.currency}
              rows={comp.map((c) => ({ ...c, baseSalary: c.baseSalary == null ? null : Number(c.baseSalary), amount: c.amount == null ? null : Number(c.amount) }))}
            />
          </TabsContent>
        )}

        {(["equipment", "leave", "projects"] as const).map((k) => (
          <TabsContent key={k} value={k}>
            <Card><EmptyState title={t("placeholder.title")} description={t("placeholder.description")} /></Card>
          </TabsContent>
        ))}
      </UrlTabs>
    </div>
  );
}
