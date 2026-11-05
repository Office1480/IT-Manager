import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { departmentOptions, employeeOptions, getEmployee } from "@/server/employees";
import { PageHeader } from "@/components/ui/misc";
import { EmployeeForm } from "@/components/people/employee-form";

export default async function EditEmployeePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("employee.write");
  const t = await getTranslations("people");
  const [employee, departments, managers] = await Promise.all([getEmployee(ctx, id), departmentOptions(ctx), employeeOptions(ctx)]);
  const name = `${employee.firstName} ${employee.lastName}`;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("editTitle", { name })}
        breadcrumb={
          <>
            <Link href="/people" className="hover:text-fg">{t("title")}</Link> / <Link href={`/people/${id}`} className="hover:text-fg">{name}</Link>
          </>
        }
      />
      <EmployeeForm initial={employee} departments={departments} managers={managers} canSensitive={ctx.can("employee.sensitive.read")} />
    </div>
  );
}
