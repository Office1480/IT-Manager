import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireContext } from "@/server/context";
import { employeeOptions } from "@/server/employees";
import { listProjects } from "@/server/projects";
import { PageHeader } from "@/components/ui/misc";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";

export async function generateMetadata() {
  return { title: (await getTranslations("projects"))("title") };
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const ctx = await requireContext("project.read");
  const t = await getTranslations("projects");
  const [projects, employees] = await Promise.all([listProjects(ctx), employeeOptions(ctx)]);
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: projects.length })} actions={ctx.can("project.write") && <ProjectFormDialog employees={employees} />} />
      <ProjectsGrid
        me={ctx.employeeId}
        projects={projects.map((p) => ({
          id: p.id, key: p.key, name: p.name, tagline: p.tagline, status: p.status, criticality: p.criticality, color: p.color,
          owner: p.owner, deputy: p.deputy, ownerExpertise: p.ownerExpertise, deputyExpertise: p.deputyExpertise,
          stages: p.backlog.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.stage]: (acc[b.stage] ?? 0) + 1 }), {}),
        }))}
      />
    </>
  );
}
