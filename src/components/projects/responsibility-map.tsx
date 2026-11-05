"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Grid3x3, Network } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Expertise } from "./expertise";

export type MapPerson = { id: string; firstName: string; lastName: string; jobTitle: string | null; department: string | null };
export type MapProject = { id: string; name: string; key: string; color: string; criticality: string; status: string; ownerId: string | null; deputyId: string | null; ownerExpertise: number; deputyExpertise: number };

const ROW = 52;

export function ResponsibilityMap({ people, projects }: { people: MapPerson[]; projects: MapProject[] }) {
  const t = useTranslations("map");
  const tp = useTranslations("projects");
  const [view, setView] = useState<"graph" | "matrix">("graph");
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const mid = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(400);

  useEffect(() => {
    if (!mid.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(mid.current);
    return () => ro.disconnect();
  }, [view]);

  // Ordonne les personnes par charge pour des liens plus lisibles
  const load = useMemo(() => {
    const m = new Map<string, { owner: number; deputy: number }>();
    for (const p of projects) {
      if (p.ownerId) m.set(p.ownerId, { ...(m.get(p.ownerId) ?? { owner: 0, deputy: 0 }), owner: (m.get(p.ownerId)?.owner ?? 0) + 1 });
      if (p.deputyId) m.set(p.deputyId, { ...(m.get(p.deputyId) ?? { owner: 0, deputy: 0 }), deputy: (m.get(p.deputyId)?.deputy ?? 0) + 1 });
    }
    return m;
  }, [projects]);
  const involved = useMemo(
    () => people.filter((p) => load.has(p.id)).sort((a, b) => (load.get(b.id)!.owner * 2 + load.get(b.id)!.deputy) - (load.get(a.id)!.owner * 2 + load.get(a.id)!.deputy)),
    [people, load],
  );
  const pIndex = new Map(involved.map((p, i) => [p.id, i]));
  // Projets triés par position moyenne de leurs responsables (réduit les croisements)
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => {
      const ya = ((pIndex.get(a.ownerId ?? "") ?? 99) * 2 + (pIndex.get(a.deputyId ?? "") ?? 99)) / 3;
      const yb = ((pIndex.get(b.ownerId ?? "") ?? 99) * 2 + (pIndex.get(b.deputyId ?? "") ?? 99)) / 3;
      return ya - yb;
    }),
    [projects, involved], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const rows = Math.max(involved.length, sortedProjects.length, 1);
  const H = rows * ROW;
  const offL = ((rows - involved.length) * ROW) / 2;
  const offR = ((rows - sortedProjects.length) * ROW) / 2;
  const focus = hover ?? sel;
  const related = (pid: string) => {
    if (!focus) return true;
    const p = sortedProjects.find((x) => x.id === pid)!;
    return focus === pid || focus === p.ownerId || focus === p.deputyId;
  };
  const personActive = (id: string) => !focus || focus === id || sortedProjects.some((p) => p.id === focus && (p.ownerId === id || p.deputyId === id));

  const links = sortedProjects.flatMap((p, j) => {
    const y2 = offR + j * ROW + ROW / 2;
    return (["owner", "deputy"] as const).flatMap((role) => {
      const pid = role === "owner" ? p.ownerId : p.deputyId;
      if (!pid || !pIndex.has(pid)) return [];
      const y1 = offL + pIndex.get(pid)! * ROW + ROW / 2;
      const d = `M 0 ${y1} C ${w * 0.5} ${y1}, ${w * 0.5} ${y2}, ${w} ${y2}`;
      const on = related(p.id) && (!focus || focus === p.id || focus === pid);
      return [<path key={`${p.id}-${role}`} d={d} fill="none" stroke={p.color} strokeWidth={role === "owner" ? 2.5 : 1.6} strokeDasharray={role === "deputy" ? "5 4" : undefined} opacity={on ? (role === "owner" ? 0.9 : 0.75) : 0.08} className="transition-opacity duration-200" />];
    });
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <div className="flex rounded-lg border border-border p-0.5">
          {(["graph", "matrix"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-fg-muted", view === v && "bg-surface-hover text-fg")}>
              {v === "graph" ? <Network className="size-3.5" /> : <Grid3x3 className="size-3.5" />}{t(v)}
            </button>
          ))}
        </div>
        {view === "graph" && (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="2.5" /></svg>{t("ownerLine")}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 4" /></svg>{t("deputyLine")}</span>
            <span className="ms-auto hidden text-xs text-fg-subtle sm:inline">{t("clickHint")}</span>
          </>
        )}
      </div>

      {view === "graph" ? (
        <div dir="ltr" className="overflow-x-auto scrollbar-thin">
          <div className="flex min-w-[720px] px-4 py-6" style={{ height: H + 48 }} onClick={() => setSel(null)}>
            <div className="relative w-56 shrink-0" style={{ height: H }}>
              {involved.map((p, i) => {
                const l = load.get(p.id)!;
                return (
                  <button
                    key={p.id}
                    onClick={(e) => { e.stopPropagation(); setSel(sel === p.id ? null : p.id); }}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover(null)}
                    className={cn("absolute inset-x-0 flex h-10 items-center gap-2.5 rounded-xl border bg-surface px-2.5 text-start shadow-sm transition-all", sel === p.id ? "border-accent ring-2 ring-[var(--ring)]" : "border-border", !personActive(p.id) && "opacity-30")}
                    style={{ top: offL + i * ROW + (ROW - 40) / 2 }}
                  >
                    <Avatar id={p.id} firstName={p.firstName} lastName={p.lastName} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium leading-tight">{p.firstName} {p.lastName}</div>
                      <div className="truncate text-[10px] leading-tight text-fg-subtle">{p.jobTitle}</div>
                    </div>
                    <span className={cn("rounded-md px-1.5 text-[10px] font-semibold tabular", l.owner >= 3 ? "bg-danger-soft text-danger" : "bg-bg-subtle text-fg-muted")} title={`${t("ownerOf")} ${l.owner} · ${t("deputyOf")} ${l.deputy}`}>{l.owner}·{l.deputy}</span>
                  </button>
                );
              })}
            </div>
            <div ref={mid} className="relative min-w-40 flex-1" style={{ height: H }}>
              <svg width={w} height={H} className="absolute inset-0 overflow-visible">{links}</svg>
            </div>
            <div className="relative w-64 shrink-0" style={{ height: H }}>
              {sortedProjects.map((p, j) => (
                <div
                  key={p.id}
                  onClick={(e) => { e.stopPropagation(); setSel(sel === p.id ? null : p.id); }}
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover(null)}
                  className={cn("absolute inset-x-0 flex h-10 cursor-pointer items-center gap-2.5 overflow-hidden rounded-xl border bg-surface pe-2.5 shadow-sm transition-all", sel === p.id ? "border-accent ring-2 ring-[var(--ring)]" : "border-border", !related(p.id) && "opacity-30")}
                  style={{ top: offR + j * ROW + (ROW - 40) / 2 }}
                >
                  <span className="h-full w-1.5 shrink-0" style={{ background: p.color }} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className="block truncate text-[12px] font-semibold leading-tight hover:underline">{p.name}</Link>
                    <div className="truncate text-[10px] leading-tight text-fg-subtle">{p.key} · {tp(`criticality.${p.criticality}`)}</div>
                  </div>
                  {!p.deputyId && <span className="rounded-md bg-danger-soft px-1.5 text-[10px] font-semibold text-danger">{t("noDeputy")}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="sticky start-0 z-10 min-w-52 border-b border-e border-border bg-surface px-4 py-2 text-start text-xs font-medium text-fg-subtle">{t("people")}</th>
                {projects.map((p) => (
                  <th key={p.id} className="h-36 w-10 border-b border-border px-1 align-bottom">
                    <Link href={`/projects/${p.id}`} className="mx-auto flex w-6 items-end justify-center [writing-mode:vertical-rl] rotate-180 pb-1 text-[11px] font-semibold hover:underline" style={{ color: p.color }}>{p.name}</Link>
                  </th>
                ))}
                <th className="border-b border-s border-border px-3 text-xs font-medium text-fg-subtle">{t("load")}</th>
              </tr>
            </thead>
            <tbody>
              {involved.map((person) => {
                const l = load.get(person.id)!;
                return (
                  <tr key={person.id} className="hover:bg-surface-hover/50">
                    <td className="sticky start-0 z-10 border-b border-e border-border bg-surface px-4 py-1.5">
                      <Link href={`/people/${person.id}?tab=projects`} className="flex items-center gap-2"><Avatar id={person.id} firstName={person.firstName} lastName={person.lastName} size={22} /><span className="truncate font-medium">{person.firstName} {person.lastName}</span></Link>
                    </td>
                    {projects.map((p) => {
                      const owner = p.ownerId === person.id;
                      const deputy = p.deputyId === person.id;
                      return (
                        <td key={p.id} className="border-b border-border p-1 text-center">
                          {owner && <span className="inline-flex size-7 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ background: p.color }} title={`${tp("owner")} · ${p.ownerExpertise}/5`}>O{p.ownerExpertise}</span>}
                          {deputy && <span className="inline-flex size-7 items-center justify-center rounded-lg border-2 text-[10px] font-bold" style={{ borderColor: p.color, color: p.color }} title={`${tp("deputy")} · ${p.deputyExpertise}/5`}>S{p.deputyExpertise}</span>}
                        </td>
                      );
                    })}
                    <td className="border-b border-s border-border px-3 text-center">
                      <span className={cn("rounded-md px-1.5 py-0.5 font-semibold tabular", l.owner >= 3 ? "bg-danger-soft text-danger" : "text-fg-muted")}>{l.owner} / {l.deputy}</span>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="sticky start-0 border-e border-border bg-surface px-4 py-2 text-xs font-medium text-fg-subtle">{t("busFactor")}</td>
                {projects.map((p) => {
                  const n = (p.ownerId ? 1 : 0) + (p.deputyId ? 1 : 0);
                  return <td key={p.id} className="p-1 text-center"><span className={cn("text-xs font-bold tabular", n < 2 ? "text-danger" : "text-success")}>{n}</span></td>;
                })}
                <td />
              </tr>
            </tbody>
          </table>
          <div className="flex items-center gap-4 px-4 py-2.5 text-[11px] text-fg-subtle">
            <span className="inline-flex items-center gap-1.5"><Expertise level={5} />5 = {tp("expertise.5")}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
