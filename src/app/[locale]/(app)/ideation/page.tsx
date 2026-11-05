import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireContext } from "@/server/context";
import { canManageProject, listBacklog, listProjects, riceScore } from "@/server/projects";
import { PageHeader } from "@/components/ui/misc";
import { Kanban, NewIdeaButton } from "@/components/projects/kanban";
import { IdeationFilter } from "@/components/projects/ideation-filter";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("ideation") };
}

export default async function IdeationPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ project?: string }> }) {
  setRequestLocale((await params).locale);
  const ctx = await requireContext("project.read");
  const t = await getTranslations("nav");
  const { project } = await searchParams;
  const [items, projects] = await Promise.all([listBacklog(ctx, project || undefined), listProjects(ctx)]);
  return (
    <>
      <PageHeader
        title={t("ideation")}
        actions={
          <>
            <IdeationFilter projects={projects.map((p) => ({ id: p.id, name: p.name }))} value={project ?? ""} />
            {ctx.can("backlog.write") && projects.length > 0 && <NewIdeaButton projects={projects.map((p) => ({ id: p.id, name: p.name }))} defaultProjectId={project} />}
          </>
        }
      />
      <Kanban
        showProject={!project}
        items={items.map((b) => ({
          id: b.id, number: b.number, title: b.title, stage: b.stage, position: b.position, rice: riceScore(b), comments: b._count.comments,
          jiraKey: b.jiraKey, jiraUrl: b.jiraUrl, author: b.author, project: { id: b.project.id, name: b.project.name, key: b.project.key, color: b.project.color },
          canManage: canManageProject(ctx, b.project), isAuthor: !!ctx.employeeId && b.authorId === ctx.employeeId,
        }))}
      />
    </>
  );
}
