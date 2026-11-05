import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CalendarX2, ShieldAlert, ShieldCheck, UserX, Weight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Card, CardHeader } from "@/components/ui/card";
import { fmtDate } from "@/lib/format";
import type { continuityRisks } from "@/server/projects";

type Risk = Awaited<ReturnType<typeof continuityRisks>>[number];

export async function RiskPanel({ risks, title }: { risks: Risk[]; title?: string }) {
  const t = await getTranslations("map");
  const tp = await getTranslations("projects");
  const locale = await getLocale();
  const icon = { noDeputy: UserX, lowDeputy: ShieldAlert, coverageGap: CalendarX2, overloaded: Weight };
  const tone = { noDeputy: "text-danger bg-danger-soft", coverageGap: "text-danger bg-danger-soft", lowDeputy: "text-warning bg-warning-soft", overloaded: "text-warning bg-warning-soft" };
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-1.5"><AlertTriangle className="size-4 text-warning" />{title ?? t("risks")}</span>} description={risks.length ? String(risks.length) : undefined} />
      {risks.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-6 text-[13px] text-success"><ShieldCheck className="size-4" />{t("noRisk")}</div>
      ) : (
        <ul className="divide-y divide-border">
          {risks.map((r, i) => {
            const Icon = icon[r.kind];
            const text =
              r.kind === "noDeputy" ? t("noDeputy")
              : r.kind === "lowDeputy" ? t("lowDeputy", { level: r.data.level, crit: tp(`criticality.${r.data.crit}`).toLowerCase() })
              : r.kind === "coverageGap" ? t("coverageGap", { owner: String(r.data.owner), deputy: String(r.data.deputy), date: fmtDate(new Date(`${r.data.date}T00:00:00Z`), locale) })
              : t("overloaded", { count: r.data.count });
            const href = r.projectId ? `/projects/${r.projectId}` : `/people/${r.employeeId}?tab=projects`;
            return (
              <li key={i}>
                <Link href={href} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-hover">
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${tone[r.kind]}`}><Icon className="size-3.5" /></span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{r.projectName ?? String(r.data.name)}</div>
                    <div className="text-xs text-fg-muted">{text}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
