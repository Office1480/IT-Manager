"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FolderKanban, Search, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { Expertise } from "./expertise";

type P = { id: string; firstName: string; lastName: string } | null;
export type ProjectCardData = {
  id: string; key: string; name: string; tagline: string | null; status: string; criticality: string; color: string;
  owner: P; deputy: P; ownerExpertise: number; deputyExpertise: number; stages: Record<string, number>;
};

const CRIT_TONE = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", CRITICAL: "danger" } as const;

export function ProjectsGrid({ projects, me }: { projects: ProjectCardData[]; me: string | null }) {
  const t = useTranslations("projects");
  const tb = useTranslations("backlog");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const list = useMemo(
    () =>
      projects.filter((p) => {
        if (status && p.status !== status) return false;
        if (mine && p.owner?.id !== me && p.deputy?.id !== me) return false;
        const n = q.toLowerCase();
        return !n || `${p.name} ${p.key} ${p.owner?.firstName ?? ""} ${p.owner?.lastName ?? ""}`.toLowerCase().includes(n);
      }),
    [projects, q, status, mine, me],
  );
  const Person = ({ p, role, level, color }: { p: P; role: string; level: number; color: string }) => (
    <div className="flex min-w-0 items-center gap-2">
      {p ? <Avatar id={p.id} firstName={p.firstName} lastName={p.lastName} size={26} /> : <span className="flex size-[26px] items-center justify-center rounded-full border border-dashed border-danger text-danger"><ShieldAlert className="size-3" /></span>}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-fg-subtle">{role}</div>
        <div className={cn("truncate text-[13px] font-medium leading-tight", !p && "text-danger")}>{p ? `${p.firstName} ${p.lastName}` : t("noDeputy")}</div>
        {p && <Expertise level={level} color={color} className="mt-1" />}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="ps-8" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">{t("allStatuses")}</option>
          {(["ACTIVE", "BUILD", "MAINTENANCE", "SUNSET"] as const).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </Select>
        {me && (
          <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-fg-muted">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="accent-[var(--accent)]" />{t("mine")}
          </label>
        )}
      </div>
      {list.length === 0 ? (
        <Card><EmptyState icon={<FolderKanban />} title={t("empty")} description={t("emptyHint")} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const total = Object.values(p.stages).reduce((a, b) => a + b, 0);
            const open = total - (p.stages.IN_JIRA ?? 0) - (p.stages.REJECTED ?? 0);
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
                <div className="h-1" style={{ background: p.color }} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white" style={{ background: p.color }}>{p.key.slice(0, 3)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold">{p.name}</div>
                      <div className="truncate text-xs text-fg-subtle">{p.tagline ?? p.key}</div>
                    </div>
                    <Badge tone={CRIT_TONE[p.criticality as keyof typeof CRIT_TONE]}>{t(`criticality.${p.criticality}`)}</Badge>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Person p={p.owner} role={t("owner")} level={p.ownerExpertise} color={p.color} />
                    <Person p={p.deputy} role={t("deputy")} level={p.deputyExpertise} color={p.color} />
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-xs text-fg-subtle">
                    <span>{t(`status.${p.status}`)}</span>
                    <span className="flex items-center gap-2">
                      {(["IDEA", "SCOPING", "DEFINITION", "REVIEW", "VALIDATED"] as const).map((s) => p.stages[s] ? <span key={s} title={tb(`stage.${s}`)} className="tabular">{tb(`stage.${s}`).charAt(0)}·{p.stages[s]}</span> : null)}
                      <span className="font-medium text-fg-muted">{t("ideas", { count: open })}</span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
