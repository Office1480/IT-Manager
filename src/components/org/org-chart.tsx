"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Minus, Plus, Search } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type OrgNode = { id: string; firstName: string; lastName: string; jobTitle: string | null; managerId: string | null; department: { name: string; color: string } | null; status: string };

export function OrgChart({ people }: { people: OrgNode[] }) {
  const t = useTranslations("orgChart");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState(0.85);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);
  const children = useMemo(() => {
    const m = new Map<string | null, OrgNode[]>();
    const ids = new Set(people.map((p) => p.id));
    for (const p of people) {
      const key = p.managerId && ids.has(p.managerId) ? p.managerId : null;
      m.set(key, [...(m.get(key) ?? []), p]);
    }
    for (const list of m.values()) list.sort((a, b) => a.firstName.localeCompare(b.firstName));
    return m;
  }, [people]);
  const countAll = (id: string): number => (children.get(id) ?? []).reduce((s, c) => s + 1 + countAll(c.id), 0);
  const match = (p: OrgNode) => q && `${p.firstName} ${p.lastName} ${p.jobTitle ?? ""}`.toLowerCase().includes(q.toLowerCase());

  const Node = ({ p }: { p: OrgNode }) => {
    const kids = children.get(p.id) ?? [];
    const open = !collapsed.has(p.id);
    return (
      <li>
        <div className={cn("relative w-52 rounded-xl border bg-surface p-3 text-center shadow-sm transition-all hover:shadow-md", match(p) ? "border-accent ring-2 ring-[var(--ring)]" : "border-border")}>
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-xl" style={{ background: p.department?.color ?? "var(--border)" }} />
          <Link href={`/people/${p.id}`} className="flex flex-col items-center">
            <Avatar id={p.id} firstName={p.firstName} lastName={p.lastName} size={40} />
            <div className="mt-2 truncate text-[13px] font-semibold">{p.firstName} {p.lastName}</div>
            <div className="truncate text-[11px] text-fg-subtle">{p.jobTitle ?? "—"}</div>
            {p.department && <div className="mt-1 text-[10px] font-medium" style={{ color: p.department.color }}>{p.department.name}</div>}
          </Link>
          {kids.length > 0 && (
            <button
              onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
              className="absolute -bottom-3 left-1/2 flex h-6 -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-surface px-2 text-[10px] font-semibold text-fg-muted shadow-sm hover:text-fg"
            >
              {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}{countAll(p.id)}
            </button>
          )}
        </div>
        {kids.length > 0 && open && (
          <ul className="mt-3">
            {kids.map((k) => <Node key={k.id} p={k} />)}
          </ul>
        )}
      </li>
    );
  };

  const roots = children.get(null) ?? [];
  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="ps-8" placeholder="…" />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setCollapsed(new Set())}>{t("expandAll")}</Button>
        <Button size="sm" variant="ghost" onClick={() => setCollapsed(new Set(people.filter((p) => (children.get(p.id) ?? []).length).map((p) => p.id)))}>{t("collapseAll")}</Button>
        <div className="flex items-center rounded-lg border border-border">
          <button className="p-1.5 text-fg-muted hover:text-fg" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}><Minus className="size-3.5" /></button>
          <span className="w-10 text-center text-xs tabular">{Math.round(zoom * 100)}%</span>
          <button className="p-1.5 text-fg-muted hover:text-fg" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}><Plus className="size-3.5" /></button>
        </div>
      </div>
      <div ref={scroller} className="overflow-auto scrollbar-thin p-6" style={{ maxHeight: "75vh" }}>
        <div dir="ltr" style={{ zoom }} className="org mx-auto w-max">
          <ul>{roots.map((r) => <Node key={r.id} p={r} />)}</ul>
        </div>
      </div>
    </div>
  );
}
