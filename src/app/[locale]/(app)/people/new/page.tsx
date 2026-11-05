import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { departmentOptions, employeeOptions, nextEmployeeNumber } from "@/server/employees";
import { PageHeader } from "@/components/ui/misc";
import { EmployeeForm } from "@/components/people/employee-form";

export default async function NewEmployeePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const ctx = await requireContext("employee.write");
  const t = await getTranslations("people");
  const [departments, managers, number] = await Promise.all([departmentOptions(ctx), employeeOptions(ctx), nextEmployeeNumber(ctx.orgId)]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("new")} breadcrumb={<Link href="/people" className="hover:text-fg">{t("title")}</Link>} />
      <EmployeeForm departments={departments} managers={managers} canSensitive={ctx.can("employee.sensitive.read")} suggestedNumber={number} />
    </div>
  );
}
