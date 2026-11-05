import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { employeeOptions } from "@/server/employees";
import { canManageProject, continuityRisks, getProject, riceScore } from "@/server/projects";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Expertise } from "@/components/projects/expertise";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Kanban, NewIdeaButton } from "@/components/projects/kanban";
import { RiskPanel } from "@/components/projects/risk-panel";
import { ProjectDeleteButton } from "@/components/projects/project-delete";

const CRIT_TONE = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", CRITICAL: "danger" } as const;

export default async function ProjectPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("project.read");
  const t = await getTranslations("projects");
  const [p, employees, allRisks] = await Promise.all([getProject(ctx, id), employeeOptions(ctx), continuityRisks(ctx)]);
  const manage = canManageProject(ctx, p);
  const links = (Array.isArray(p.links) ? p.links : []) as { label: string; url: string }[];
  const risks = allRisks.filter((r) => r.projectId === p.id || (r.kind === "overloaded" && (r.employeeId === p.ownerId || r.employeeId === p.deputyId)));

  const PersonCard = ({ role, person, level }: { role: string; person: typeof p.owner; level: number }) => (
    <div className="flex items-center gap-3 rounded-xl border border-border p-4">
      {person ? (
        <>
          <Link href={`/people/${person.id}?tab=projects`}><Avatar id={person.id} firstName={person.firstName} lastName={person.lastName} size={44} /></Link>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{role}</div>
            <Link href={`/people/${person.id}`} className="block truncate text-[14px] font-semibold hover:underline">{person.firstName} {person.lastName}</Link>
            <div className="mt-1 flex items-center gap-2"><Expertise level={level} color={p.color} /><span className="text-[11px] text-fg-subtle">{t(`expertise.${level}`)}</span></div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3 text-danger"><span className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-danger/50"><ShieldAlert className="size-5" /></span><div><div className="text-[11px] font-medium uppercase tracking-wider">{role}</div><div className="text-[13px] font-semibold">{role === t("owner") ? t("noOwner") : t("noDeputy")}</div></div></div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="text-xs text-fg-subtle"><Link href="/projects" className="hover:text-fg">{t("title")}</Link></div>
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl text-[15px] font-bold text-white shadow-sm" style={{ background: p.color }}>{p.key.slice(0, 3)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">{p.name}</h1>
            <Badge tone={CRIT_TONE[p.criticality]}>{t(`criticality.${p.criticality}`)}</Badge>
            <Badge>{t(`status.${p.status}`)}</Badge>
          </div>
          {p.tagline && <p className="mt-1 text-[13px] text-fg-muted">{p.tagline}</p>}
        </div>
        {manage && (
          <div className="flex gap-2">
            <ProjectFormDialog trigger="edit" employees={employees} initial={{ ...p, links }} />
            {ctx.can("project.write") && <ProjectDeleteButton id={p.id} />}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PersonCard role={t("owner")} person={p.owner} level={p.ownerExpertise} />
            <PersonCard role={t("deputy")} person={p.deputy} level={p.deputyExpertise} />
          </div>
          <Card>
            <CardHeader title={t("fields.definition")} />
            <CardBody className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">{p.definition || <span className="text-fg-subtle">{t("definitionEmpty")}</span>}</CardBody>
          </Card>
        </div>
        <div className="space-y-5">
          <RiskPanel risks={risks} title={t("risks")} />
          {links.length > 0 && (
            <Card>
              <CardHeader title={t("links")} />
              <ul className="p-2">
                {links.map((l) => (
                  <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] hover:bg-surface-hover"><ExternalLink className="size-3.5 text-fg-subtle" /><span className="truncate">{l.label}</span></a></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">{t("backlog")}</h2>
          {ctx.can("backlog.write") && <NewIdeaButton defaultProjectId={p.id} />}
        </div>
        <Kanban
          items={p.backlog.map((b) => ({
            id: b.id, number: b.number, title: b.title, stage: b.stage, position: b.position, rice: riceScore(b), comments: b._count.comments,
            jiraKey: b.jiraKey, jiraUrl: b.jiraUrl, author: b.author, project: { id: p.id, name: p.name, key: p.key, color: p.color },
            canManage: manage, isAuthor: !!ctx.employeeId && b.authorId === ctx.employeeId,
          }))}
        />
      </div>
    </div>
  );
}
