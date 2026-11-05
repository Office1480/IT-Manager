import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireContext } from "@/server/context";
import { PageHeader } from "@/components/ui/misc";
import { OrgChart } from "@/components/org/org-chart";

export async function generateMetadata() {
  return { title: (await getTranslations("orgChart"))("title") };
}

export default async function OrgChartPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const ctx = await requireContext("employee.read.all");
  const t = await getTranslations("orgChart");
  const people = await db.employee.findMany({
    where: { organizationId: ctx.orgId, deletedAt: null, status: { not: "OFFBOARDED" } },
    select: { id: true, firstName: true, lastName: true, jobTitle: true, managerId: true, status: true, department: { select: { name: true, color: true } } },
  });
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <OrgChart people={people} />
    </>
  );
}
