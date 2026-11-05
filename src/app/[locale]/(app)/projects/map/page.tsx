import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireContext } from "@/server/context";
import { continuityRisks, listProjects } from "@/server/projects";
import { PageHeader } from "@/components/ui/misc";
import { ResponsibilityMap } from "@/components/projects/responsibility-map";
import { RiskPanel } from "@/components/projects/risk-panel";

export async function generateMetadata() {
  return { title: (await getTranslations("map"))("title") };
}

export default async function MapPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const ctx = await requireContext("project.read");
  const t = await getTranslations("map");
  const [projects, people, risks] = await Promise.all([
    listProjects(ctx),
    db.employee.findMany({ where: { organizationId: ctx.orgId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } } }),
    continuityRisks(ctx),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-4">
        <div className="2xl:col-span-3">
          <ResponsibilityMap
            people={people.map((p) => ({ ...p, department: p.department?.name ?? null }))}
            projects={projects.filter((p) => p.status !== "SUNSET").map((p) => ({ id: p.id, name: p.name, key: p.key, color: p.color, criticality: p.criticality, status: p.status, ownerId: p.ownerId, deputyId: p.deputyId, ownerExpertise: p.ownerExpertise, deputyExpertise: p.deputyExpertise }))}
          />
        </div>
        <RiskPanel risks={risks} />
      </div>
    </div>
  );
}
