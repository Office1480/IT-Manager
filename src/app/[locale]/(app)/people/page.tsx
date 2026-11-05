import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { departmentOptions, listEmployees } from "@/server/employees";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { PeopleTable } from "@/components/people/people-table";

export async function generateMetadata() {
  const t = await getTranslations("people");
  return { title: t("title") };
}

export default async function PeoplePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const ctx = await requireContext("employee.read.all");
  const t = await getTranslations("people");
  const [rows, departments] = await Promise.all([listEmployees(ctx, { status: "all" }), departmentOptions(ctx)]);
  const current = rows.filter((r) => r.status !== "OFFBOARDED").length;
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { count: current })}
        actions={
          ctx.can("employee.write") && (
            <Button asChild variant="primary">
              <Link href="/people/new">
                <Plus />
                {t("new")}
              </Link>
            </Button>
          )
        }
      />
      <PeopleTable rows={rows} departments={departments} />
    </>
  );
}
