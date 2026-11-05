import { getTranslations } from "next-intl/server";
import { FolderKanban } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Expertise } from "./expertise";

type Row = { id: string; name: string; key: string; color: string; role: "owner" | "deputy"; level: number; other: string | null };

export async function EmployeeProjects({ rows }: { rows: Row[] }) {
  const t = await getTranslations("projects");
  if (!rows.length) return <Card><EmptyState icon={<FolderKanban />} title={t("empty")} /></Card>;
  return (
    <Card>
      <CardHeader title={t("title")} />
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id + r.role}>
            <Link href={`/projects/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover">
              <span className="flex size-9 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ background: r.color }}>{r.key.slice(0, 3)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{r.name}</div>
                <div className="text-xs text-fg-subtle">{r.role === "owner" ? t("deputy") : t("owner")} : {r.other ?? "—"}</div>
              </div>
              <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={r.role === "owner" ? { background: r.color, color: "white" } : { border: `1.5px solid ${r.color}`, color: r.color }}>{t(r.role)}</span>
              <Expertise level={r.level} color={r.color} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
