"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ChevronDown, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CalPerson = { id: string; firstName: string; lastName: string; jobTitle: string | null; department: { id: string; name: string; color: string } | null };
export type CalLeave = { id: string; employeeId: string; start: string; end: string; startHalf: boolean; endHalf: boolean; status: "PENDING" | "APPROVED"; typeName: string; color: string; days: number };
export type CalHoliday = { date: string; kind: "HOLIDAY" | "EVE"; name: string };

const DAY = 86_400_000;
const parse = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function TeamCalendar({
  from,
  days,
  span,
  people,
  leaves,
  holidays,
  workDays,
  today,
  types,
}: {
  from: string;
  days: number;
  span: 1 | 3;
  people: CalPerson[];
  leaves: CalLeave[];
  holidays: CalHoliday[];
  workDays: number[];
  today: string;
  types: { name: string; color: string }[];
}) {
  const t = useTranslations("leave");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [dep, setDep] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const colW = span === 1 ? 38 : 15;
  const intl = locale === "he" ? "he-IL" : locale === "en" ? "en-GB" : "fr-FR";

  const start = parse(from);
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * DAY)), [from, days]); // eslint-disable-line react-hooks/exhaustive-deps
  const hol = useMemo(() => new Map(holidays.map((h) => [h.date, h])), [holidays]);
  const todayIdx = Math.round((parse(today).getTime() - start.getTime()) / DAY);

  const nav = (params: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const shift = (months: number) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
    nav({ month: iso(d).slice(0, 7) });
  };

  const departments = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color: string }>();
    for (const p of people) if (p.department) m.set(p.department.id, p.department);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  const filtered = people.filter((p) => (!dep || p.department?.id === dep) && (!q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q.toLowerCase())));
  const groups = useMemo(() => {
    const g = new Map<string, { key: string; name: string; color: string; people: CalPerson[] }>();
    for (const p of filtered) {
      const key = p.department?.id ?? "_";
      if (!g.has(key)) g.set(key, { key, name: p.department?.name ?? "—", color: p.department?.color ?? "#a1a1aa", people: [] });
      g.get(key)!.people.push(p);
    }
    return [...g.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const byPerson = useMemo(() => {
    const m = new Map<string, CalLeave[]>();
    for (const l of leaves) m.set(l.employeeId, [...(m.get(l.employeeId) ?? []), l]);
    return m;
  }, [leaves]);

  const visibleIds = new Set(filtered.map((p) => p.id));
  const absentByDay = dates.map((d) => {
    const s = iso(d);
    return leaves.filter((l) => visibleIds.has(l.employeeId) && l.start <= s && l.end >= s).length;
  });

  const isOff = (d: Date) => !workDays.includes(d.getUTCDay()) || hol.get(iso(d))?.kind === "HOLIDAY";

  // Bandeaux de mois (vue trimestre)
  const months: { label: string; from: number; len: number }[] = [];
  dates.forEach((d, i) => {
    const label = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
    if (!months.length || months[months.length - 1].label !== label) months.push({ label, from: i, len: 1 });
    else months[months.length - 1].len++;
  });

  const width = days * colW;
  const NAME_W = 220;

  const bar = (l: CalLeave) => {
    const s = Math.max(0, Math.round((parse(l.start).getTime() - start.getTime()) / DAY));
    const e = Math.min(days - 1, Math.round((parse(l.end).getTime() - start.getTime()) / DAY));
    if (e < 0 || s > days - 1) return null;
    const left = s * colW + (l.startHalf && parse(l.start) >= start ? colW / 2 : 0) + 2;
    const right = (e + 1) * colW - (l.endHalf && parse(l.end).getTime() <= start.getTime() + (days - 1) * DAY ? colW / 2 : 0) - 2;
    const pending = l.status === "PENDING";
    return (
      <div
        key={l.id}
        title={`${l.typeName} · ${l.start} → ${l.end} · ${l.days} j${pending ? ` · ${t("status.PENDING")}` : ""}`}
        className={cn("absolute top-1.5 flex h-[26px] items-center overflow-hidden rounded-md px-1.5 text-[11px] font-medium text-white shadow-sm transition-transform hover:z-10 hover:scale-y-110", pending && "ring-1 ring-inset")}
        style={{
          insetInlineStart: left,
          width: Math.max(6, right - left),
          background: pending ? `repeating-linear-gradient(135deg, ${l.color}55 0 6px, ${l.color}2a 6px 12px)` : `linear-gradient(180deg, ${l.color}, ${l.color}dd)`,
          color: pending ? l.color : "white",
          ["--tw-ring-color" as string]: l.color,
        }}
      >
        {right - left > 46 && <span className="truncate">{l.typeName}</span>}
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => shift(-span)} aria-label="prev"><ChevronLeft className="rtl:rotate-180" /></Button>
          <Button size="sm" onClick={() => nav({ month: null })}>{t("today")}</Button>
          <Button size="icon" variant="ghost" onClick={() => shift(span)} aria-label="next"><ChevronRight className="rtl:rotate-180" /></Button>
        </div>
        <div className="min-w-0 text-[15px] font-semibold capitalize">
          {months.map((m) => m.label).filter((v, i, a) => a.indexOf(v) === i).join(" – ")}
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="w-44 ps-8" placeholder="…" />
          </div>
          <Select value={dep} onChange={(e) => setDep(e.target.value)} className="w-auto">
            <option value="">{t("allDepartments")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <div className="flex rounded-lg border border-border p-0.5">
            {([1, 3] as const).map((s) => (
              <button key={s} onClick={() => nav({ span: s === 1 ? null : "3" })} className={cn("rounded-md px-2.5 py-1 text-xs font-medium text-fg-muted", span === s && "bg-surface-hover text-fg")}>
                {s === 1 ? t("month") : t("quarter")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative overflow-x-auto scrollbar-thin">
        <div style={{ width: NAME_W + width }} className="relative">
          {/* En-tête */}
          <div className="sticky top-0 z-20 flex border-b border-border bg-surface">
            <div className="sticky start-0 z-30 shrink-0 border-e border-border bg-surface" style={{ width: NAME_W }} />
            <div className="relative" style={{ width }}>
              {span === 3 && (
                <div className="flex border-b border-border">
                  {months.map((m) => (
                    <div key={m.label + m.from} className="truncate border-e border-border px-2 py-1 text-[11px] font-medium capitalize text-fg-muted" style={{ width: m.len * colW }}>{m.label}</div>
                  ))}
                </div>
              )}
              <div className="flex">
                {dates.map((d, i) => {
                  const h = hol.get(iso(d));
                  const off = isOff(d);
                  return (
                    <div key={i} title={h?.name} className={cn("flex shrink-0 flex-col items-center justify-center py-1.5 text-[10px] leading-tight", off ? "text-fg-subtle" : "text-fg-muted", i === todayIdx && "font-bold text-accent")} style={{ width: colW }}>
                      {span === 1 && <span className="uppercase">{new Intl.DateTimeFormat(intl, { weekday: "narrow", timeZone: "UTC" }).format(d)}</span>}
                      <span className={cn("tabular", span === 1 ? "mt-0.5 text-[12px]" : "", i === todayIdx && span === 1 && "flex size-5 items-center justify-center rounded-full bg-accent text-white")}>
                        {span === 1 || d.getUTCDate() % 5 === 1 ? d.getUTCDate() : ""}
                      </span>
                      {h && <span className={cn("mt-0.5 size-1 rounded-full", h.kind === "HOLIDAY" ? "bg-danger" : "bg-warning")} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Fond : week-ends, fêtes, aujourd'hui */}
          <div className="pointer-events-none absolute bottom-0 top-0" style={{ insetInlineStart: NAME_W, width }}>
            {dates.map((d, i) => {
              const h = hol.get(iso(d));
              const off = isOff(d);
              if (!off && !h && i !== todayIdx) return null;
              return (
                <div
                  key={i}
                  className={cn("absolute bottom-0 top-0", i === todayIdx ? "bg-accent/10" : h?.kind === "EVE" ? "bg-warning/[0.07]" : "bg-bg-subtle")}
                  style={{ insetInlineStart: i * colW, width: colW, ...(off && i !== todayIdx ? { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 4px, rgba(127,127,140,.07) 4px 8px)" } : {}) }}
                />
              );
            })}
            {todayIdx >= 0 && todayIdx < days && <div className="absolute bottom-0 top-0 w-px bg-accent/60" style={{ insetInlineStart: todayIdx * colW + colW / 2 }} />}
          </div>

          {/* Lignes */}
          {groups.map((g) => (
            <div key={g.key}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}
                className="sticky start-0 z-10 flex h-8 items-center gap-2 bg-bg-subtle/90 px-4 text-[11px] font-semibold uppercase tracking-wider text-fg-muted backdrop-blur"
                style={{ width: NAME_W + width }}
              >
                <ChevronDown className={cn("size-3.5 transition-transform", collapsed[g.key] && "-rotate-90 rtl:rotate-90")} />
                <span className="size-2 rounded-full" style={{ background: g.color }} />
                {g.name}
                <span className="font-normal normal-case tracking-normal text-fg-subtle">{g.people.length}</span>
              </button>
              {!collapsed[g.key] &&
                g.people.map((p) => (
                  <div key={p.id} className="group flex h-[38px] border-b border-border/60 hover:bg-surface-hover/40">
                    <Link href={`/people/${p.id}?tab=leave`} className="sticky start-0 z-10 flex shrink-0 items-center gap-2.5 border-e border-border bg-surface px-4 group-hover:bg-surface-hover" style={{ width: NAME_W }}>
                      <Avatar id={p.id} firstName={p.firstName} lastName={p.lastName} size={24} />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium leading-tight">{p.firstName} {p.lastName}</div>
                        <div className="truncate text-[11px] leading-tight text-fg-subtle">{p.jobTitle}</div>
                      </div>
                    </Link>
                    <div className="relative" style={{ width }}>{(byPerson.get(p.id) ?? []).map(bar)}</div>
                  </div>
                ))}
            </div>
          ))}

          {/* Taux de présence */}
          <div className="sticky bottom-0 z-20 flex border-t border-border bg-surface">
            <div className="sticky start-0 z-30 flex shrink-0 items-center border-e border-border bg-surface px-4 text-[11px] font-semibold uppercase tracking-wider text-fg-muted" style={{ width: NAME_W }}>{t("presence")}</div>
            <div className="flex" style={{ width }}>
              {dates.map((d, i) => {
                const n = absentByDay[i];
                const ratio = filtered.length ? n / filtered.length : 0;
                const off = isOff(d);
                return (
                  <div key={i} className="flex h-8 shrink-0 items-center justify-center p-0.5" style={{ width: colW }} title={t("absentCount", { count: n })}>
                    {!off && (
                      <div
                        className="flex h-full w-full items-center justify-center rounded text-[10px] font-semibold tabular"
                        style={{ background: n === 0 ? "var(--success-soft)" : ratio < 0.2 ? "var(--warning-soft)" : "var(--danger-soft)", color: n === 0 ? "var(--success)" : ratio < 0.2 ? "var(--warning)" : "var(--danger)" }}
                      >
                        {span === 1 ? (n || "") : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-[11px] text-fg-muted">
        {types.map((ty) => (
          <span key={ty.name} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: ty.color }} />{ty.name}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm ring-1 ring-fg-subtle" style={{ background: "repeating-linear-gradient(135deg,#a1a1aa55 0 3px,transparent 3px 6px)" }} />{t("pendingLegend")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-danger" />{t("holiday")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warning" />{t("eve")}</span>
      </div>
    </Card>
  );
}
