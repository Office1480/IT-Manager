"use client";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { Select } from "@/components/ui/input";

export function IdeationFilter({ projects, value }: { projects: { id: string; name: string }[]; value: string }) {
  const t = useTranslations("backlog");
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Select value={value} onChange={(e) => router.push(e.target.value ? `${pathname}?project=${e.target.value}` : pathname)} className="w-auto">
      <option value="">{t("allProjects")}</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>
  );
}
